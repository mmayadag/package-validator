export const REPOSITORY_QUERY = /* GraphQL */ `
  query Repository($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
    }
  }
`;

/** Reads package.json from the repository's default branch, whatever it is called. */
export const PACKAGE_JSON_QUERY = /* GraphQL */ `
  query PackageJson($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: "HEAD:package.json") {
        ... on Blob {
          text
        }
      }
    }
  }
`;
