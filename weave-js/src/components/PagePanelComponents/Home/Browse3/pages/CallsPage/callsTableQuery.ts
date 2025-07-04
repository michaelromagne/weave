import {
  GridFilterModel,
  GridLogicOperator,
  GridPaginationModel,
  GridSortModel,
} from '@mui/x-data-grid-pro';
import {useCallback, useMemo} from 'react';

import {useDeepMemo} from '../../../../../../hookUtils';
import {
  getCachedByKeyWithExpiry,
  setCacheByKeyWithExpiry,
  simpleHash,
} from '../../browserCacheUtils';
import {
  isValuelessOperator,
  makeDateFilter,
  makeMonthFilter,
  makeRawDateFilter,
} from '../../filters/common';
import {addCostsToCallResults} from '../CallPage/cost';
import {operationConverter} from '../common/tabularListViews/operators';
import {useWFHooks} from '../wfReactInterface/context';
import {Query} from '../wfReactInterface/traceServerClientInterface/query';
import {
  CallFilter,
  CallSchema,
} from '../wfReactInterface/wfDataModelHooksInterface';
import {WFHighLevelCallFilter} from './callsTableFilter';

export const DEFAULT_FILTER_CALLS: GridFilterModel = {
  items: [],
  logicOperator: GridLogicOperator.And,
};

/**
 * This Hook is responsible for bridging the gap between the CallsTable
 * component and the underlying data hooks. In particular, it takes a high level
 * filter, column filter, sort def, page def, and expanded columns and returns
 * the associated calls. Internally, we convert each of these data structures
 * from their higher level representation to the lower-level API representation.
 *
 * Moreover, we also handle extracting the counts for a given query which is used to
 * determine the total number of calls for pagination.
 */
export const useCallsForQuery = (
  entity: string,
  project: string,
  filter: WFHighLevelCallFilter,
  gridFilter: GridFilterModel,
  gridPage: GridPaginationModel,
  gridSort?: GridSortModel,
  expandedColumns?: Set<string>,
  columns?: string[],
  options?: {
    includeTotalStorageSize?: boolean;
  }
): {
  costsLoading: boolean;
  result: CallSchema[];
  loading: boolean;
  total: number;
  refetch: () => void;
  storageSizeLoading: boolean;
  storageSizeResults: Map<string, number> | null;
  primaryError?: Error | null;
  costsError?: Error | null;
  storageSizeError?: Error | null;
} => {
  const {useCalls, useCallsStats} = useWFHooks();
  const effectiveOffset = gridPage?.page * gridPage?.pageSize;
  const effectiveLimit = gridPage.pageSize;
  const {sortBy, lowLevelFilter, filterBy} = useFilterSortby(
    filter,
    gridFilter,
    gridSort
  );

  const calls = useCalls({
    entity,
    project,
    filter: lowLevelFilter,
    limit: effectiveLimit,
    offset: effectiveOffset,
    sortBy,
    query: filterBy,
    columns,
    expandedRefColumns: expandedColumns,
    refetchOnDelete: true,
    includeFeedback: true,
  });

  const callsStats = useCallsStats({
    entity,
    project,
    filter: lowLevelFilter,
    query: filterBy,
    refetchOnDelete: true,
  });

  const callResults = useMemo(() => {
    return getFeedbackMerged(calls.result ?? []);
  }, [calls]);

  const total = useMemo(() => {
    if (callsStats.loading || callsStats.result == null) {
      return effectiveOffset + callResults.length;
    } else {
      return callsStats.result.count;
    }
  }, [
    callResults.length,
    callsStats.loading,
    callsStats.result,
    effectiveOffset,
  ]);

  const costFilter: CallFilter = useMemo(
    () => ({
      callIds: calls.result?.map(call => call.traceCall?.id || '') || [],
    }),
    [calls.result]
  );

  const costCols = useMemo(() => ['id'], []);
  const noCalls = calls.result == null || calls.result.length === 0;
  const costs = useCalls({
    entity,
    project,
    filter: costFilter,
    limit: effectiveLimit,
    columns: costCols,
    expandedRefColumns: expandedColumns,
    skip: calls.loading || noCalls,
    includeCosts: true,
  });

  const storageSizeCols = useMemo(() => ['id', 'total_storage_size_bytes'], []);
  const storageSizeFilter = costFilter;

  const storageSize = useCalls({
    entity,
    project,
    filter: storageSizeFilter,
    limit: effectiveLimit,
    columns: storageSizeCols,
    expandedRefColumns: expandedColumns,
    skip: calls.loading || noCalls || !options?.includeTotalStorageSize,
    includeTotalStorageSize: true,
  });

  const storageSizeResults = useMemo(() => {
    if (storageSize.loading) {
      return null;
    }
    return new Map(
      storageSize.result?.map(r => [
        r.callId,
        r.totalStorageSizeBytes as number,
      ])
    );
  }, [storageSize]);

  const costResults = useMemo(() => {
    return getFeedbackMerged(costs.result ?? []);
  }, [costs]);
  const refetch = useCallback(() => {
    calls.refetch();
    costs.refetch();
    callsStats.refetch();
  }, [calls, callsStats, costs]);

  return useMemo(() => {
    if (calls.loading) {
      return {
        costsLoading: costs.loading,
        loading: calls.loading,
        result: [],
        total: 0,
        refetch,
        storageSizeLoading: storageSize.loading,
        storageSizeResults: null,
      };
    }

    return {
      costsLoading: costs.loading,
      storageSizeLoading: storageSize.loading,
      storageSizeResults,
      loading: calls.loading,
      // Return faster calls query results until cost query finishes
      result: calls.loading
        ? []
        : costResults.length > 0
        ? addCostsToCallResults(callResults, costResults)
        : callResults,
      total,
      refetch,
      primaryError: calls.error,
      costsError: costs.error,
      storageSizeError: storageSize.error,
    };
  }, [
    callResults,
    calls.loading,
    total,
    costs.loading,
    costResults,
    refetch,
    storageSize.loading,
    storageSizeResults,
    calls.error,
    costs.error,
    storageSize.error,
  ]);
};

export const useFilterSortby = (
  filter: WFHighLevelCallFilter,
  gridFilter: GridFilterModel,
  gridSort: GridSortModel | undefined
) => {
  const sortBy = useDeepMemo(
    useMemo(() => (gridSort ? getSortBy(gridSort) : []), [gridSort])
  );
  const lowLevelFilter: CallFilter = useMemo(() => {
    return convertHighLevelFilterToLowLevelFilter(filter);
  }, [filter]);
  const filterByRaw = useMemo(() => getFilterByRaw(gridFilter), [gridFilter]);
  const filterBy: Query | undefined = useMemo(
    () => getFilterBy(filterByRaw),
    [filterByRaw]
  );

  return {
    sortBy,
    lowLevelFilter,
    filterBy,
  };
};

export const getFilterByRaw = (
  gridFilter: GridFilterModel
): Query['$expr'] | undefined => {
  const completeItems = gridFilter.items.filter(
    item => item.value !== undefined || isValuelessOperator(item.operator)
  );

  const convertedItems = completeItems
    .map(operationConverter)
    .filter(item => item !== null) as Array<Query['$expr']>;

  if (convertedItems.length === 0) {
    return undefined;
  }

  if (convertedItems.length === 1) {
    return convertedItems[0];
  }

  const operation = gridFilter.logicOperator === 'or' ? '$or' : '$and'; // and is default

  return {
    [operation]: convertedItems,
  } as Query['$expr'];
};

const getSortBy = (gridSort: GridSortModel) => {
  return gridSort.map(sort => {
    return {
      field: sort.field,
      direction: sort.sort ?? 'asc',
    };
  });
};

const getFilterBy = (
  filterByRaw: Query['$expr'] | undefined
): Query | undefined => {
  if (filterByRaw === undefined) {
    return undefined;
  }
  return {$expr: filterByRaw} as Query;
};

export const convertHighLevelFilterToLowLevelFilter = (
  effectiveFilter: WFHighLevelCallFilter
): CallFilter => {
  return {
    traceRootsOnly: effectiveFilter.traceRootsOnly,
    opVersionRefs: effectiveFilter.opVersionRefs,
    inputObjectVersionRefs: effectiveFilter.inputObjectVersionRefs,
    outputObjectVersionRefs: effectiveFilter.outputObjectVersionRefs,
    parentIds: effectiveFilter.parentId
      ? [effectiveFilter.parentId]
      : undefined,
    runIds: effectiveFilter.runIds,
  };
};

// Warning: This is a lossy conversion, there are things we
// can represent in a low level filter that we cannot represent
// in a high level filter.
export const convertLowLevelFilterToHighLevelFilter = (
  lowLevelFilter: CallFilter
): WFHighLevelCallFilter => {
  const highLevelFilter: WFHighLevelCallFilter = {};
  if (lowLevelFilter.opVersionRefs) {
    highLevelFilter.opVersionRefs = lowLevelFilter.opVersionRefs;
  }
  if (lowLevelFilter.inputObjectVersionRefs) {
    highLevelFilter.inputObjectVersionRefs =
      lowLevelFilter.inputObjectVersionRefs;
  }
  if (lowLevelFilter.outputObjectVersionRefs) {
    highLevelFilter.outputObjectVersionRefs =
      lowLevelFilter.outputObjectVersionRefs;
  }
  if (lowLevelFilter.parentIds) {
    highLevelFilter.parentId = lowLevelFilter.parentIds[0];
  }
  if (lowLevelFilter.traceRootsOnly) {
    highLevelFilter.traceRootsOnly = lowLevelFilter.traceRootsOnly;
  }
  return highLevelFilter;
};

const getFeedbackMerged = (calls: CallSchema[]) => {
  // for each call, reduce all feedback to the latest feedback of each type
  return calls.map(c => {
    if (!c.traceCall?.summary?.weave?.feedback) {
      return c;
    }
    const feedback = c.traceCall?.summary?.weave?.feedback?.reduce(
      (acc: Record<string, any>, curr: Record<string, any>) => {
        // keep most recent feedback of each type
        if (acc[curr.feedback_type]?.created_at > curr.created_at) {
          return acc;
        }
        acc[curr.feedback_type] = curr;
        return acc;
      },
      {}
    );
    c.traceCall = {
      ...c.traceCall,
      summary: {
        ...c.traceCall.summary,
        weave: {
          ...c.traceCall.summary.weave,
          feedback,
        },
      },
    };
    return c;
  });
};

const CACHE_KEY_PREFIX = 'weave_datetime_filter_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

const datetimeFilterCacheKey = (
  entity: string,
  project: string,
  filter: WFHighLevelCallFilter
) => {
  // hash the filter
  const filterHash = simpleHash(JSON.stringify(filter));
  return `${CACHE_KEY_PREFIX}${entity}_${project}_${filterHash}`;
};

export const useMakeInitialDatetimeFilter = (
  entity: string,
  project: string,
  highLevelFilter: WFHighLevelCallFilter,
  skip: boolean
): {initialDatetimeFilter: GridFilterModel} => {
  // Fire off 2 stats queries, one for the # of calls in the last 7 days
  // one for the  # of calls in the last 30 days.
  // If the first query returns > 50 calls, set the default filter to 7 days
  // Else if the second query returns > 50 calls, set to 30 days
  // Else set a default filter to 6 months
  // On the creation of a filter --> stash to browser history with 1 day expiry
  // Use the cache preferentially when available
  const {useCallsStats} = useWFHooks();
  const d30filter = useMemo(() => {
    return makeRawDateFilter(30);
  }, []);
  const d7filter = useMemo(() => {
    return makeRawDateFilter(7);
  }, []);

  const key = datetimeFilterCacheKey(entity, project, highLevelFilter);
  const cachedFilter = useMemo(
    () => getCachedByKeyWithExpiry(key, CACHE_EXPIRY_MS),
    [key]
  );
  const filter: CallFilter = useMemo(() => {
    return convertHighLevelFilterToLowLevelFilter(highLevelFilter);
  }, [highLevelFilter]);

  const callStats7Days = useCallsStats({
    entity,
    project,
    filter,
    query: d7filter,
    skip: skip || cachedFilter != null,
  });
  const callStats30Days = useCallsStats({
    entity,
    project,
    filter,
    query: d30filter,
    skip: skip || cachedFilter != null,
  });

  const defaultDatetimeFilter = useMemo(
    () => ({
      items: [makeDateFilter(7)],
      logicOperator: GridLogicOperator.And,
    }),
    []
  );

  const computedDatetimeFilter = useMemo(() => {
    // Wait for both stats queries to return
    if (callStats7Days.loading || callStats30Days.loading) {
      return defaultDatetimeFilter;
    }

    // If no cache or expired, compute new filter
    let newFilter = null;
    if (callStats7Days.result && callStats7Days.result.count >= 50) {
      newFilter = defaultDatetimeFilter;
    } else if (callStats30Days.result && callStats30Days.result.count >= 50) {
      newFilter = {
        items: [makeMonthFilter()],
        logicOperator: GridLogicOperator.And,
      };
    } else if (callStats30Days.result && callStats30Days.result.count < 50) {
      // If there are no calls found in the last 30 days, just don't set a filter
      newFilter = {
        items: [],
        logicOperator: GridLogicOperator.And,
      };
    }
    // Cache the new filter if we computed one
    if (newFilter) {
      setCacheByKeyWithExpiry(key, newFilter);
    }
    return newFilter;
  }, [callStats7Days, callStats30Days, defaultDatetimeFilter, key]);

  if (cachedFilter) {
    return {
      initialDatetimeFilter: cachedFilter as GridFilterModel,
    };
  }

  return {
    initialDatetimeFilter: computedDatetimeFilter ?? defaultDatetimeFilter,
  };
};
