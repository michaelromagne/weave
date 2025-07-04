/**
 * This file is primarily responsible for exporting `useCallsTableColumns` which is a hook that
 * returns the columns for the calls table.
 */

import {
  GridColDef,
  GridColumnGroupingModel,
  GridRenderCellParams,
} from '@mui/x-data-grid-pro';
import {LoadingDots} from '@wandb/weave/components/LoadingDots';
import {Tooltip} from '@wandb/weave/components/Tooltip';
import {UserLink} from '@wandb/weave/components/UserLink';
import {convertBytes} from '@wandb/weave/util';
import React, {
  FC,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import {TEAL_600} from '../../../../../../common/css/color.styles';
import {useDeepMemo} from '../../../../../../common/state/hooks';
import {monthRoundedTime} from '../../../../../../common/util/time';
import {isWeaveObjectRef, parseRef} from '../../../../../../react';
import {makeRefCall} from '../../../../../../util/refs';
import {Timestamp} from '../../../../../Timestamp';
import {CellValue} from '../../../Browse2/CellValue';
import {CellValueRun} from '../../../Browse2/CellValueRun';
import {TableRowSelectionContext} from '../../../TableRowSelectionContext';
import {
  convertFeedbackFieldToBackendFilter,
  parseFeedbackType,
} from '../../feedback/HumanFeedback/tsHumanFeedback';
import {
  convertScorerFeedbackFieldToBackendFilter,
  parseScorerFeedbackField,
  RUNNABLE_FEEDBACK_IN_SUMMARY_PREFIX,
  RUNNABLE_FEEDBACK_OUTPUT_PART,
} from '../../feedback/HumanFeedback/tsScorerFeedback';
import {Reactions} from '../../feedback/Reactions';
import {
  CellFilterWrapper,
  OnUpdateFilter,
} from '../../filters/CellFilterWrapper';
import {isWeaveRef} from '../../filters/common';
import {
  getCostsFromCellParams,
  getTokensFromCellParams,
} from '../CallPage/cost';
import {isEvaluateOp} from '../common/heuristics';
import {CallLink} from '../common/Links';
import {StatusChip} from '../common/StatusChip';
import {buildDynamicColumns} from '../common/tabularListViews/columnBuilder';
import {
  ComputedCallStatuses,
  TraceCallSchema,
} from '../wfReactInterface/traceServerClientTypes';
import {
  convertISOToDate,
  flattenedTraceCallStatusCode,
  traceCallLatencyMs,
  traceCallLatencyS,
} from '../wfReactInterface/tsDataModelHooks';
import {opVersionRefOpName} from '../wfReactInterface/utilities';
import {FlattenedCallData} from './CallsTable';
import {
  insertPath,
  isDynamicCallColumn,
  Path,
  pathToString,
  stringToPath,
} from './callsTableColumnsUtil';
import {WFHighLevelCallFilter} from './callsTableFilter';
import {OpVersionIndexText} from './OpVersionIndexText';

const HIDDEN_DYNAMIC_COLUMN_PREFIXES = [
  'summary.usage',
  'summary.weave',
  'summary.status_counts',
  'feedback',
];

export const useCallsTableColumns = (
  entity: string,
  project: string,
  effectiveFilter: WFHighLevelCallFilter,
  currentViewId: string,
  tableData: FlattenedCallData[],
  expandedRefCols: Set<string>,
  onCollapse: (col: string) => void,
  onExpand: (col: string) => void,
  columnIsRefExpanded: (col: string) => boolean,
  allowedColumnPatterns?: string[],
  onUpdateFilter?: OnUpdateFilter,
  costsLoading: boolean = false,
  costsHasError: boolean = false,
  includeTotalStorageSizeBytes: boolean = false,
  storageSizeResults: Map<string, number> | null = null,
  storageSizeLoading: boolean = false,
  storageHasError: boolean = false
) => {
  const [userDefinedColumnWidths, setUserDefinedColumnWidths] = useState<
    Record<string, number>
  >({});

  // Determine which columns have refs to expand. Followup: this might want
  // to be an ever-growing list. Instead, this is recalculated on each page.
  // This is used to determine which columns should be expandable / collapsible.
  const columnsWithRefs = useMemo(() => {
    const refColumns = new Set<string>();
    tableData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (refIsExpandable((row as any)[key])) {
          refColumns.add(key);
        }
      });
    });

    return refColumns;
  }, [tableData]);

  const shouldIgnoreColumn = useCallback(
    (col: string) => {
      const columnsWithRefsList = Array.from(columnsWithRefs);
      // Captures the case where the column has just been expanded.
      for (const refCol of columnsWithRefsList) {
        if (col.startsWith(refCol + '.')) {
          return true;
        }
      }
      return false;
    },
    [columnsWithRefs]
  );

  // If either of these values has changed we'll reset the dynamic columns.
  const resetDep = {effectiveFilter, currentViewId};
  const allDynamicColumnNames = useAllDynamicColumnNames(
    tableData,
    shouldIgnoreColumn,
    resetDep
  );

  // Determine what sort of view we are looking at based on the filter
  const isSingleOpVersion = useMemo(
    () => effectiveFilter.opVersionRefs?.length === 1,
    [effectiveFilter.opVersionRefs]
  );
  const isSingleOp = useMemo(
    () =>
      effectiveFilter.opVersionRefs?.length === 1 &&
      effectiveFilter.opVersionRefs[0].includes(':*'),
    [effectiveFilter.opVersionRefs]
  );
  const preservePath = useMemo(
    () =>
      effectiveFilter.opVersionRefs?.length === 1 &&
      effectiveFilter.opVersionRefs[0].includes('predict_and_score:'),
    [effectiveFilter.opVersionRefs]
  );

  const columns = useMemo(
    () =>
      buildCallsTableColumns(
        entity,
        project,
        preservePath,
        isSingleOp,
        isSingleOpVersion,
        allDynamicColumnNames,
        expandedRefCols,
        onCollapse,
        columnsWithRefs,
        onExpand,
        columnIsRefExpanded,
        userDefinedColumnWidths,
        allowedColumnPatterns,
        onUpdateFilter,
        costsLoading,
        costsHasError,
        includeTotalStorageSizeBytes
          ? {
              storageSizeResults,
              storageSizeLoading,
            }
          : null,
        storageHasError
      ),
    [
      entity,
      project,
      preservePath,
      isSingleOp,
      isSingleOpVersion,
      allDynamicColumnNames,
      expandedRefCols,
      onCollapse,
      columnsWithRefs,
      onExpand,
      columnIsRefExpanded,
      userDefinedColumnWidths,
      allowedColumnPatterns,
      onUpdateFilter,
      costsLoading,
      includeTotalStorageSizeBytes,
      storageSizeResults,
      storageSizeLoading,
      storageHasError,
      costsHasError,
    ]
  );

  return useMemo(() => {
    return {
      columns,
      setUserDefinedColumnWidths,
    };
  }, [columns, setUserDefinedColumnWidths]);
};

const CallLinkCell: FC<{
  rowParams: GridRenderCellParams;
  entity: string;
  project: string;
  preservePath: boolean;
}> = ({rowParams, entity, project, preservePath}) => {
  const {getDescendantCallIdAtSelectionPath} = useContext(
    TableRowSelectionContext
  );

  const opName =
    rowParams.row.display_name ??
    opVersionRefOpName(rowParams.row.op_name) ??
    rowParams.row.op_name;
  const isEval = isEvaluateOp(opVersionRefOpName(rowParams.row.op_name));

  return (
    <CallLink
      entityName={entity}
      projectName={project}
      opName={opName}
      callId={rowParams.row.id}
      fullWidth={true}
      color={TEAL_600}
      isEval={isEval}
      focusedCallId={
        preservePath
          ? getDescendantCallIdAtSelectionPath?.(rowParams.row.id) ?? undefined
          : undefined
      }
    />
  );
};

function buildCallsTableColumns(
  entity: string,
  project: string,
  preservePath: boolean,
  isSingleOp: boolean,
  isSingleOpVersion: boolean,
  allDynamicColumnNames: string[],
  expandedRefCols: Set<string>,
  onCollapse: (col: string) => void,
  columnsWithRefs: Set<string>,
  onExpand: (col: string) => void,
  columnIsRefExpanded: (col: string) => boolean,
  userDefinedColumnWidths: Record<string, number>,
  allowedColumnPatterns?: string[],
  onUpdateFilter?: OnUpdateFilter,
  costsLoading: boolean = false,
  costsHasError: boolean = false,
  storageSizeInfo: {
    storageSizeResults: Map<string, number> | null;
    storageSizeLoading: boolean;
  } | null = null,
  storageHasError: boolean = false
): {
  cols: Array<GridColDef<TraceCallSchema>>;
  colGroupingModel: GridColumnGroupingModel;
} {
  // Filters summary.usage. because we add a derived column for tokens and cost
  // Sort attributes after inputs and outputs.
  const filteredDynamicColumnNames = allDynamicColumnNames
    .filter(
      c => !HIDDEN_DYNAMIC_COLUMN_PREFIXES.some(p => c.startsWith(p + '.'))
    )
    .sort((a, b) => {
      const prefixes = ['inputs.', 'output.', 'attributes.'];
      const aPrefix =
        a === 'output' ? 'output.' : prefixes.find(p => a.startsWith(p)) ?? '';
      const bPrefix =
        b === 'output' ? 'output.' : prefixes.find(p => b.startsWith(p)) ?? '';
      if (aPrefix !== bPrefix) {
        return prefixes.indexOf(aPrefix) - prefixes.indexOf(bPrefix);
      }
      return a.localeCompare(b);
    });

  const cols: Array<GridColDef<TraceCallSchema>> = [
    {
      field: 'summary.weave.trace_name',
      headerName: 'Trace',
      minWidth: 100,
      width: 250,
      hideable: false,
      display: 'flex',
      valueGetter: (unused: any, row: any) => {
        const op_name = row.op_name;
        if (!isWeaveRef(op_name)) {
          return op_name;
        }
        return opVersionRefOpName(op_name);
      },
      renderCell: rowParams => {
        const name =
          rowParams.row.display_name ??
          // Rows are flattened at this point, they DO NOT strictly
          // follow the TraceCallSchema!
          (rowParams.row as any)['summary.weave.trace_name'];
        return (
          <CellFilterWrapper
            onUpdateFilter={onUpdateFilter}
            field="summary.weave.trace_name"
            rowId={rowParams.id.toString()}
            operation={'(string): equals'}
            value={name}
            style={{
              display: 'flex',
              width: '100%',
            }}>
            <CallLinkCell
              rowParams={rowParams}
              entity={entity}
              project={project}
              preservePath={preservePath}
            />
          </CellFilterWrapper>
        );
      },
    },
    {
      field: 'feedback',
      headerName: 'Feedback',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (rowParams: GridRenderCellParams) => {
        const rowIndex = rowParams.api.getRowIndexRelativeToVisibleRows(
          rowParams.id
        );
        const callId = rowParams.row.id;
        const weaveRef = makeRefCall(entity, project, callId);
        return (
          <Reactions
            weaveRef={weaveRef}
            forceVisible={rowIndex === 0}
            twWrapperStyles={{
              width: '100%',
              height: '100%',
            }}
          />
        );
      },
    },
    ...(isSingleOp && !isSingleOpVersion
      ? [
          {
            field: 'derived.op_version',
            headerName: 'Op Version',
            type: 'number' as const,
            align: 'right' as const,
            disableColumnMenu: true,
            sortable: false,
            filterable: false,
            resizable: false,
            renderCell: (cellParams: any) => (
              <OpVersionIndexText opVersionRef={cellParams.row.op_name} />
            ),
          },
        ]
      : []),
    {
      field: 'summary.weave.status',
      headerName: 'Status',
      headerAlign: 'center',
      sortable: true,
      // disableColumnMenu: true,
      resizable: false,
      width: 59,
      display: 'flex',
      valueGetter: (unused: any, row: any) => {
        return flattenedTraceCallStatusCode(row);
      },
      renderCell: cellParams => {
        const valueStatus = flattenedTraceCallStatusCode(cellParams.row);
        const valueFilter = ComputedCallStatuses[valueStatus];
        return (
          <CellFilterWrapper
            onUpdateFilter={onUpdateFilter}
            field="summary.weave.status"
            rowId={cellParams.id.toString()}
            operation={'(string): in'}
            value={valueFilter}>
            <div style={{margin: 'auto'}}>
              <StatusChip value={valueStatus} iconOnly />
            </div>
          </CellFilterWrapper>
        );
      },
    },
  ];

  const {cols: newCols, groupingModel} = buildDynamicColumns<TraceCallSchema>(
    filteredDynamicColumnNames,
    row => {
      const [rowEntity, rowProject] = row.project_id.split('/');
      return {entity: rowEntity, project: rowProject};
    },
    (row, key) => (row as any)[key],
    key => expandedRefCols.has(key),
    key => columnsWithRefs.has(key),
    onCollapse,
    onExpand,
    // TODO (Tim) - (BackendExpansion): This can be removed once we support backend expansion!
    key => !columnIsRefExpanded(key) && !columnsWithRefs.has(key),
    (key, operator, value, rowId) => {
      onUpdateFilter?.(key, operator, value, rowId);
    }
  );
  cols.push(...newCols);

  // Create special feedback columns with grouping model
  const annotationColNames = allDynamicColumnNames.filter(
    c =>
      c.startsWith('summary.weave.feedback.wandb.annotation') &&
      c.endsWith('payload.value')
  );
  if (annotationColNames.length > 0) {
    // Add feedback group to grouping model
    groupingModel.push({
      groupId: 'feedback',
      headerName: 'Annotations',
      children: annotationColNames.map(col => ({
        field: convertFeedbackFieldToBackendFilter(col),
      })),
    });

    // Add feedback columns
    const annotationColumns: Array<GridColDef<TraceCallSchema>> =
      annotationColNames.map(c => {
        const parsed = parseFeedbackType(c);
        return {
          field: convertFeedbackFieldToBackendFilter(c),
          headerName: parsed ? parsed.displayName : `${c}`,
          width: 150,
          minWidth: 150,
          flex: 1,
          renderHeader: () => {
            return <div>{parsed ? parsed.userDefinedType : c}</div>;
          },
          valueGetter: (unused: any, row: any) => {
            return row[c];
          },
          renderCell: (params: GridRenderCellParams<TraceCallSchema>) => {
            return <CellValue value={params.value} />;
          },
        };
      });
    cols.push(...annotationColumns);
  }

  const scoreColNames = allDynamicColumnNames.filter(
    c =>
      c.startsWith(RUNNABLE_FEEDBACK_IN_SUMMARY_PREFIX) &&
      c.includes(RUNNABLE_FEEDBACK_OUTPUT_PART)
  );
  if (scoreColNames.length > 0) {
    // Group scores by scorer name and nested paths
    const scorerGroups = new Map<string, Map<string, string[]>>();
    scoreColNames.forEach(colName => {
      const parsed = parseScorerFeedbackField(colName);
      if (parsed) {
        const scorerName = parsed.scorerName;
        const pathParts = parsed.scorePath.replace(/^\./, '').split('.');
        // Only create a group path if there are multiple parts
        const groupPath =
          pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';

        if (!scorerGroups.has(scorerName)) {
          scorerGroups.set(scorerName, new Map());
        }
        const scorerGroup = scorerGroups.get(scorerName)!;
        if (!scorerGroup.has(groupPath)) {
          scorerGroup.set(groupPath, []);
        }
        scorerGroup.get(groupPath)!.push(colName);
      }
    });

    // Create scorer groups in the grouping model for each scorer
    const scoreGroup = {
      groupId: 'scores',
      headerName: 'Scores',
      children: Array.from(scorerGroups.entries()).map(
        ([scorerName, pathGroups]) => {
          const scorerGroupChildren = Array.from(pathGroups.entries())
            .filter(([groupPath, _]) => groupPath !== '') // Filter out non-grouped fields
            .map(([groupPath, _]) => ({
              groupId: `scores.${scorerName}.${groupPath}`,
              headerName: groupPath,
              children: [] as any[],
            }));

          return {
            groupId: `scores.${scorerName}`,
            headerName: scorerName,
            children: scorerGroupChildren,
          };
        }
      ),
    };
    groupingModel.push(scoreGroup);

    // Create columns for each scorer's fields
    const scoreColumns: Array<GridColDef<TraceCallSchema>> = [];
    scorerGroups.forEach((pathGroups, scorerName) => {
      pathGroups.forEach((colNames, groupPath) => {
        const scorerGroup = groupPath
          ? scoreGroup.children
              .find(g => g.groupId === `scores.${scorerName}`)
              ?.children.find(
                g => g.groupId === `scores.${scorerName}.${groupPath}`
              )
          : scoreGroup.children.find(g => g.groupId === `scores.${scorerName}`);

        colNames.forEach(colName => {
          const parsed = parseScorerFeedbackField(colName);
          const field = convertScorerFeedbackFieldToBackendFilter(colName);
          if (parsed === null) {
            scoreColumns.push({
              field,
              headerName: colName,
              width: 150,
              renderHeader: () => {
                return <div>{colName}</div>;
              },
              valueGetter: (unused: any, row: any) => {
                return row[colName];
              },
              renderCell: (params: GridRenderCellParams<TraceCallSchema>) => {
                return <CellValue value={params.value} />;
              },
            });
            return;
          }

          // Add to scorer's group
          scorerGroup?.children.push({field});

          const leafName =
            parsed.scorePath.split('.').pop()?.replace(/^\./, '') ||
            parsed.scorePath;

          scoreColumns.push({
            field,
            headerName: `Scores.${parsed.scorerName}${parsed.scorePath}`,
            width: 150,
            renderHeader: () => {
              return <div>{leafName}</div>;
            },
            valueGetter: (unused: any, row: any) => {
              return row[colName];
            },
            renderCell: (params: GridRenderCellParams<TraceCallSchema>) => {
              return (
                <CellFilterWrapper
                  onUpdateFilter={onUpdateFilter}
                  field={field}
                  rowId={params.id.toString()}
                  operation={null}
                  value={params.value}
                  style={{
                    height: '100%',
                    width: '100%',
                  }}>
                  <CellValue value={params.value} />
                </CellFilterWrapper>
              );
            },
          });
        });
      });
    });
    cols.push(...scoreColumns);
  }

  cols.push({
    field: 'wb_user_id',
    headerName: 'User',
    headerAlign: 'center',
    width: 50,
    align: 'center',
    sortable: false,
    resizable: false,
    display: 'flex',
    renderCell: cellParams => {
      const userId = cellParams.row.wb_user_id;
      if (userId == null) {
        return null;
      }
      return (
        <CellFilterWrapper
          onUpdateFilter={onUpdateFilter}
          field="wb_user_id"
          rowId={cellParams.id.toString()}
          operation="(string): equals"
          value={userId}>
          <UserLink userId={userId} />
        </CellFilterWrapper>
      );
    },
  });

  const startedAtCol: GridColDef<TraceCallSchema> = {
    field: 'started_at',
    headerName: 'Called',
    sortable: true,
    sortingOrder: ['desc', 'asc'],
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    renderCell: cellParams => {
      // TODO: A better filter might be to be on the same day?
      const date = convertISOToDate(cellParams.row.started_at);
      const filterDate = new Date(date);
      filterDate.setSeconds(0, 0);
      const filterValue = filterDate.toISOString();
      const value = date.getTime() / 1000;
      return (
        <CellFilterWrapper
          onUpdateFilter={onUpdateFilter}
          field="started_at"
          rowId={cellParams.id.toString()}
          operation="(date): after"
          value={filterValue}>
          <Timestamp value={value} format="relative" />
        </CellFilterWrapper>
      );
    },
  };
  cols.push(startedAtCol);

  cols.push({
    field: 'tokens',
    headerName: 'Tokens',
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    align: 'right',
    headerAlign: 'right',
    // Should probably have a custom filter here.
    filterable: false,
    sortable: false,
    valueGetter: (unused: any, row: any) => {
      const {tokensNum} = getTokensFromCellParams(row);
      return tokensNum;
    },
    renderCell: cellParams => {
      const {tokens, tokenToolTipContent} = getTokensFromCellParams(
        cellParams.row
      );
      return (
        <Tooltip trigger={<div>{tokens}</div>} content={tokenToolTipContent} />
      );
    },
  });
  cols.push({
    field: 'cost',
    headerName: 'Cost',
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    align: 'right',
    headerAlign: 'right',
    // Should probably have a custom filter here.
    filterable: false,
    sortable: false,
    valueGetter: (unused: any, row: any) => {
      const {costNum} = getCostsFromCellParams(row);
      return costNum;
    },
    renderCell: cellParams => {
      if (costsLoading) {
        return <LoadingDots />;
      }
      if (costsHasError) {
        return (
          <div className="flex h-full w-full items-center justify-center">
            <StatusChip
              value={ComputedCallStatuses.error}
              tooltipOverride="There was an error fetching the cost for this call."
            />
          </div>
        );
      }
      const {cost, costToolTipContent} = getCostsFromCellParams(cellParams.row);
      return (
        <Tooltip trigger={<div>{cost}</div>} content={costToolTipContent} />
      );
    },
  });

  cols.push({
    field: 'summary.weave.latency_ms',
    headerName: 'Latency',
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    // Should probably have a custom filter here.
    filterable: false,
    sortable: true,
    valueGetter: (unused: any, row: any) => {
      if (flattenedTraceCallStatusCode(row) === ComputedCallStatuses.running) {
        // Call is still in progress, latency will be 0.
        // Displaying nothing seems preferable to being misleading.
        return null;
      }
      return traceCallLatencyS(row);
    },
    renderCell: cellParams => {
      if (
        flattenedTraceCallStatusCode(cellParams.row) ===
        ComputedCallStatuses.running
      ) {
        // Call is still in progress, latency will be 0.
        // Displaying nothing seems preferable to being misleading.
        return null;
      }
      const timeMs = traceCallLatencyMs(cellParams.row);
      const timeString = monthRoundedTime(traceCallLatencyS(cellParams.row));
      return (
        <CellFilterWrapper
          onUpdateFilter={onUpdateFilter}
          field="summary.weave.latency_ms"
          rowId={cellParams.id.toString()}
          operation={'(number): >='}
          value={timeMs}>
          <div>{timeString}</div>
        </CellFilterWrapper>
      );
    },
  });

  if (storageSizeInfo) {
    cols.push({
      field: 'total_storage_size_bytes',
      headerName: 'Trace Size',
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      align: 'right',
      headerAlign: 'right',
      // filtering and sorting are expensive for this column, hence disabled
      filterable: false,
      sortable: false,
      renderCell: cellParams => {
        if (storageSizeInfo.storageSizeLoading) {
          return <LoadingDots />;
        }
        if (storageHasError) {
          return (
            <div className="flex h-full w-full items-center justify-center">
              <StatusChip
                value={ComputedCallStatuses.error}
                tooltipOverride="There was an error fetching the storage size for this call."
              />
            </div>
          );
        }
        const storageSize =
          storageSizeInfo.storageSizeResults?.get(cellParams.row.id) ?? null;
        return (
          <div>{storageSize !== null ? convertBytes(storageSize) : ''}</div>
        );
      },
    });
  }

  cols.push({
    field: 'wb_run_id',
    width: 150,
    minWidth: 150,
    headerName: 'Run',
    sortable: false,
    filterable: false,
    renderCell: cellParams => {
      const runId = cellParams.row.wb_run_id;
      if (runId == null) {
        return null;
      }
      const parts = runId.split('/');
      if (parts.length !== 3) {
        return <span>{runId}</span>;
      }
      const [entityName, projectName, runName] = parts;
      return (
        <CellValueRun
          entity={entityName}
          project={projectName}
          run={runName}
          onUpdateFilter={onUpdateFilter}
          rowId={cellParams.id.toString()}
        />
      );
    },
  });

  cols.forEach(col => {
    if (col.field in userDefinedColumnWidths) {
      col.width = userDefinedColumnWidths[col.field];
      col.flex = 0;
    }
  });

  // TODO: It would be better to build up the cols rather than throwing away
  //       some at the end, but making simpler change for now.
  let orderedCols = cols;
  if (allowedColumnPatterns !== undefined) {
    orderedCols = allowedColumnPatterns.flatMap(shownCol => {
      if (shownCol.includes('*')) {
        const regex = new RegExp('^' + shownCol.replace('*', '.*') + '$');
        return cols.filter(col => regex.test(col.field));
      } else {
        return cols.filter(col => col.field === shownCol);
      }
    });
  }

  return {cols: orderedCols, colGroupingModel: groupingModel};
}
/**
 * This function maintains an ever-growing list of dynamic column names. It is used to
 * determine which dynamic columns (e.g. attributes, inputs, outputs) are present in the
 * table data. If we page/filter/sort we don't want to lose the columns that were present
 * in the previous data.
 */
const useAllDynamicColumnNames = (
  tableData: FlattenedCallData[],
  shouldIgnoreColumn: (col: string) => boolean,
  resetDep: any
) => {
  const prevColumnsRef = useRef<string[]>([]);
  const memoedDep = useDeepMemo(resetDep);
  const prevResetDepRef = useRef<any>(memoedDep);

  // If resetDep changed, clear the previous columns
  if (prevResetDepRef.current !== memoedDep) {
    prevColumnsRef.current = [];
    prevResetDepRef.current = memoedDep;
  }

  // Start with any previous columns
  let currentColumnPaths: Path[] = prevColumnsRef.current
    .filter(c => !shouldIgnoreColumn(c))
    .map(stringToPath);

  // Add new columns from the current table data
  tableData.forEach(row => {
    Object.keys(row).forEach(key => {
      const keyAsPath = stringToPath(key);
      if (isDynamicCallColumn(keyAsPath)) {
        currentColumnPaths = insertPath(currentColumnPaths, keyAsPath);
      }
    });
  });

  // Convert paths back to strings
  const allDynamicColumnNames = currentColumnPaths.map(pathToString);

  // Store the current columns for the next render
  prevColumnsRef.current = allDynamicColumnNames;

  return allDynamicColumnNames;
};

const refIsExpandable = (ref: string): boolean => {
  if (!isWeaveRef(ref)) {
    return false;
  }
  const parsed = parseRef(ref);
  if (isWeaveObjectRef(parsed)) {
    return (
      parsed.weaveKind === 'object' ||
      // parsed.weaveKind === 'op' ||
      (parsed.weaveKind === 'table' &&
        parsed.artifactRefExtra != null &&
        parsed.artifactRefExtra.length > 0)
    );
  }
  return false;
};
