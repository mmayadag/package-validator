export const REPOSITORY_QUERY = /* GraphQL */ `
  query Repository($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
    }
  }
`;

/**
 * Repository existence and package.json from its default branch, whatever it
 * is called, in a single round trip.
 */
export const REPOSITORY_WITH_PACKAGE_JSON_QUERY = /* GraphQL */ `
  query RepositoryWithPackageJson($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
      object(expression: "HEAD:package.json") {
        ... on Blob {
          text
        }
      }
    }
  }
`;
