# Changelog

## [0.2.0](https://github.com/mmayadag/package-validator/compare/v0.1.0...v0.2.0) (2026-09-16)


### ⚠ BREAKING CHANGES

* **#45:** the /repo/* routes are gone. POST /repo/isValid has no replacement; use GET /v1/repositories/:owner/:repo. POST /v1/subscriptions answers 201 instead of 200.

### Features

* **#14:** persist report subscriptions in SQLite ([b38ae73](https://github.com/mmayadag/package-validator/commit/b38ae736095fc78e423eb7b3b4483248e7a143c4)), refs [#14](https://github.com/mmayadag/package-validator/issues/14)
* **#15:** send subscribed reports on their schedule ([7cc2281](https://github.com/mmayadag/package-validator/commit/7cc22810226bb402002b1e3ed4f446ff4a13051f)), refs [#15](https://github.com/mmayadag/package-validator/issues/15)
* **#16:** one-click unsubscribe link in report emails ([799f583](https://github.com/mmayadag/package-validator/commit/799f583873e81f2e4dbe389f2f7cb4548e18a7f0)), refs [#16](https://github.com/mmayadag/package-validator/issues/16)
* **#17:** rate limit the API per client IP ([5b789a8](https://github.com/mmayadag/package-validator/commit/5b789a89086832c861a05d7118233ceb1c59bcd4)), refs [#17](https://github.com/mmayadag/package-validator/issues/17)
* **#22:** require email confirmation before a subscription is active ([3a941b6](https://github.com/mmayadag/package-validator/commit/3a941b6ec421b53c1879d5d970e7d698518260af)), refs [#22](https://github.com/mmayadag/package-validator/issues/22)
* **#23:** add security headers ([02a91d1](https://github.com/mmayadag/package-validator/commit/02a91d1f3cfd7615c2a95ffd301c720e19daa465)), refs [#23](https://github.com/mmayadag/package-validator/issues/23)
* **#24:** cache dependency reports for an hour ([0420974](https://github.com/mmayadag/package-validator/commit/042097433436ef90b9a46e0e408d80ff33582b80)), refs [#24](https://github.com/mmayadag/package-validator/issues/24)
* **#25:** classify each update as major, minor or patch ([87cc33c](https://github.com/mmayadag/package-validator/commit/87cc33c7e6aa45d79577469c07cb3c7299ab9b74)), refs [#25](https://github.com/mmayadag/package-validator/issues/25)
* **#27:** structured JSON logs in production ([e8b91d1](https://github.com/mmayadag/package-validator/commit/e8b91d13836adec9921760dad4e9d3d603fbcce2)), refs [#27](https://github.com/mmayadag/package-validator/issues/27)
* **#45:** serve the API under versioned /v1 routes ([ba01dc8](https://github.com/mmayadag/package-validator/commit/ba01dc89682dea8c8d071c7afd5fdb71d5339bf1)), refs [#45](https://github.com/mmayadag/package-validator/issues/45)
* **#48:** log every request with a request id ([31b9a19](https://github.com/mmayadag/package-validator/commit/31b9a19a45998f0608a36be0a3584746aced0d32)), refs [#48](https://github.com/mmayadag/package-validator/issues/48)
* **#50:** DOCS_ENABLED switches Swagger UI off ([33b8f85](https://github.com/mmayadag/package-validator/commit/33b8f851aee46e2635ac11306cb7f3afadb386ab)), refs [#50](https://github.com/mmayadag/package-validator/issues/50)
* **#5:** add a health endpoint and Docker healthchecks ([ffd2ba2](https://github.com/mmayadag/package-validator/commit/ffd2ba2318b8067e6cf9f6d86bf089fd1afbffe1)), refs [#5](https://github.com/mmayadag/package-validator/issues/5)


### Bug Fixes

* **#12:** show the GitHub mark in dark mode ([b541181](https://github.com/mmayadag/package-validator/commit/b541181067aefbcc11e6cb2a93f08a16419d9372)), refs [#12](https://github.com/mmayadag/package-validator/issues/12)
* **#31:** resolve Dependabot alerts for ansi-regex and debug ([e8ca363](https://github.com/mmayadag/package-validator/commit/e8ca363aa1ec02658dea8ebe1b27f59041a2386c)), refs [#31](https://github.com/mmayadag/package-validator/issues/31)
* **#37:** bump the minor version for features before 1.0 ([6f23598](https://github.com/mmayadag/package-validator/commit/6f2359853b0df891abaeef431da2db124725f587)), refs [#37](https://github.com/mmayadag/package-validator/issues/37)
* **#38:** retry release-please when GitHub's GraphQL API fails ([96eb9b9](https://github.com/mmayadag/package-validator/commit/96eb9b9a860168692b3cc821963d991dae2ad95a)), refs [#38](https://github.com/mmayadag/package-validator/issues/38)
* **#3:** escape repository values in the rendered report ([354f6ec](https://github.com/mmayadag/package-validator/commit/354f6ec7e4ce594c5f7765282bdd917338477355)), refs [#3](https://github.com/mmayadag/package-validator/issues/3)
* **#40:** scan only the monorepo history for releases ([e4b6e2d](https://github.com/mmayadag/package-validator/commit/e4b6e2d22e8213d9e15e2a5c4980f13355bb7f4d)), refs [#40](https://github.com/mmayadag/package-validator/issues/40)


### Refactoring

* **#42:** move to npm workspaces with a shared contracts package ([3a0b311](https://github.com/mmayadag/package-validator/commit/3a0b311dfda360a02252bd778efe7005aaa147fa)), refs [#42](https://github.com/mmayadag/package-validator/issues/42)
* **#43:** encode every slash in a package name ([e0d4a18](https://github.com/mmayadag/package-validator/commit/e0d4a18b2f50ec604c7f0e8d7619925526cee962))
* **#43:** replace npm-check-updates with a registry client ([eeff0e4](https://github.com/mmayadag/package-validator/commit/eeff0e423bd88e57bced47c8c9b416797879aa59)), refs [#43](https://github.com/mmayadag/package-validator/issues/43)
* **#44:** split RepoService into report and subscription services ([f57bf58](https://github.com/mmayadag/package-validator/commit/f57bf5832a71b3eed8a08a00a453ed0aedc3d3f8)), refs [#44](https://github.com/mmayadag/package-validator/issues/44)
* **#49:** version the SQLite schema with ordered migrations ([ee8e0a1](https://github.com/mmayadag/package-validator/commit/ee8e0a1632bd76a2110991eca3e456c84da51ac2)), refs [#49](https://github.com/mmayadag/package-validator/issues/49)
* **#4:** restructure the API into NestJS modules ([6f43d18](https://github.com/mmayadag/package-validator/commit/6f43d1845f49fdb8a0a8778fe123cba3553fa8f5)), refs [#4](https://github.com/mmayadag/package-validator/issues/4)
* **#7:** migrate the UI to Vite, TypeScript and Svelte 5 runes ([0db69b4](https://github.com/mmayadag/package-validator/commit/0db69b43613ec37605e6f67e3f83b7e0984cf32e)), refs [#7](https://github.com/mmayadag/package-validator/issues/7)


### Documentation

* **#10:** publish the architecture diagram and rewrite the README ([23bb65c](https://github.com/mmayadag/package-validator/commit/23bb65c6ff83a0703d8dc2a58fc879a17f368f8d)), refs [#10](https://github.com/mmayadag/package-validator/issues/10)
* **#11:** replace the placeholder security policy ([8535359](https://github.com/mmayadag/package-validator/commit/85353591e0ce7fb6f22812a01d4a0b7709d1c77c)), refs [#11](https://github.com/mmayadag/package-validator/issues/11)
* **#18:** show subscriptions and scheduled delivery in the diagram ([8fad72f](https://github.com/mmayadag/package-validator/commit/8fad72fc9f1fff2d9998f7fdb102f03273ac445f)), refs [#18](https://github.com/mmayadag/package-validator/issues/18)
* **#26:** publish OpenAPI documentation ([b5fa78e](https://github.com/mmayadag/package-validator/commit/b5fa78e835837e7c9e7590c5d1c6658bb4f0e84c)), refs [#26](https://github.com/mmayadag/package-validator/issues/26)
* **#28:** contribution guide, issue and PR templates, CodeQL ([77c9a74](https://github.com/mmayadag/package-validator/commit/77c9a742a98e9f2c57437938fa5f778c71a08d6d)), refs [#28](https://github.com/mmayadag/package-validator/issues/28)
* **#30:** add screenshots and a walkthrough to the README ([c53f72f](https://github.com/mmayadag/package-validator/commit/c53f72f6cbf5068b593cf062aaca7520b6957468)), refs [#30](https://github.com/mmayadag/package-validator/issues/30)
* **#39:** credit the author ([87933f6](https://github.com/mmayadag/package-validator/commit/87933f646ac4204c1b4e25eca5b194fe52c9fc4a)), refs [#39](https://github.com/mmayadag/package-validator/issues/39)
