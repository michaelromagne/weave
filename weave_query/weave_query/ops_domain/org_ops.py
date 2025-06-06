from weave_query import weave_types as types
from weave_query.ops_domain import wb_domain_types as wdt
from weave_query.ops_domain.wandb_domain_gql import (
    gql_connection_op,
    gql_direct_edge_op,
    gql_prop_op,
    gql_root_op,
)
from weave_query.constants import (
    LIMIT_ORG_PROJECTS,
    LIMIT_ORG_REPORTS,
    LIMIT_ORG_ARTIFACTS,
)

# Section 1/6: Tag Getters
#

# Section 2/6: Root Ops
org = gql_root_op(
    "root-org",
    "organization",
    wdt.OrgType,
    {
        "orgName": types.String(),
    },
    lambda inputs: f'name: {inputs["orgName"]}',
)

# Section 3/6: Attribute Getters
gql_prop_op("org-name", wdt.OrgType, "name", types.String())


# Section 4/6: Direct Relationship Ops
gql_direct_edge_op(
    "org-teams",
    wdt.OrgType,
    "teams",
    wdt.EntityType,
    is_many=True,
)

# Section 5/6: Connection Ops
gql_connection_op(
    "org-projects",
    wdt.OrgType,
    "projects",
    wdt.ProjectType,
    {},
    lambda inputs: f"first: {LIMIT_ORG_PROJECTS}",
)

gql_connection_op(
    "org-reports",
    wdt.OrgType,
    "views",
    wdt.ReportType,
    {},
    lambda inputs: f"first: {LIMIT_ORG_REPORTS}",
)

gql_connection_op(
    "org-artifacts",
    wdt.OrgType,
    "artifactCollections",
    wdt.ArtifactCollectionType,
    {},
    lambda inputs: f"first: {LIMIT_ORG_ARTIFACTS}",
)

# Section 6/6: Non Standard Business Logic Ops
#
