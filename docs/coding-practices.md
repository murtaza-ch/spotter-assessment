# Coding practices

Optimize for code that the next developer can read without tracing a chain of helpers.

## General

- Name functions after what they do. Include units in numeric names, such as
  `wind_speed_mph`, `distance_miles`, and `load_weight_lb`.
- Give each module one clear responsibility. Extract code when it reduces a real
  dependency or duplication, not simply to make a file shorter.
- Avoid generic `utils`, `helpers`, `BaseService`, and repository abstractions without
  a concrete use case. Django's ORM already provides database access.
- Add comments for assumptions and non-obvious decisions. Avoid narrating the code.
- Prefer explicit inputs and return values over mutable globals and hidden state.
- Keep secrets and generated build output out of Git.

## TypeScript and React

- TypeScript strict mode, checked indexing, and exact optional properties are enabled.
  Avoid `any`, unsafe casts, and non-null assertions used to bypass errors.
- Use function components, descriptive prop names, and named exports.
- Keep feature-specific code in its feature. Shared components should not import
  feature hooks or make hidden network requests.
- Fetch server data through feature API functions and TanStack Query hooks. Keep
  transport configuration in the shared client. Do not copy server data into a second
  global store.
- Show loading, empty, and error states where relevant. Abort obsolete requests.
- Use semantic HTML, accessible names, keyboard support, and visible focus styles.
- Use Chakra tokens consistently. Risk colors must also have text labels or another
  non-color indicator.

## Python and Django

- Add parameter and return annotations to application functions. Use small dataclasses
  for internal values when they clarify the model; DRF serializers define API inputs
  and outputs.
- Keep views thin. Place workflow orchestration in a service only when that workflow
  exists. Domain calculations should run without a request, database, or network.
- Validate external values at the boundary. Convert provider units and timestamps once
  before passing them into calculations. Use timezone-aware datetimes in UTC internally.
- Catch specific exceptions where a recovery or translation is possible. Preserve
  unexpected failures for logging; never silently replace missing data with safe data.
- Define response serializers and schema annotations for every endpoint. Regenerate
  the API contract in the same change.
- Keep migrations under version control when models are introduced.

## Verification

Run `npm run check` before a PR. Run `npm run test:e2e` for UI or API integration
changes. Run both locally before pushing. GitHub Actions is disabled for this repository.

Test behavior and boundary conditions. Planning tests cover the
exact weather thresholds, load overrides, elapsed-time sampling, distance-weighted
summaries, and recommendation ordering. Mock provider I/O in those tests, then use a
small number of integration tests for the adapters.

Frontend unit tests cover forecast-grid interpolation and masking. Browser tests cover
responsive layout, route selection, checkpoint popups, slider caching, blocked routes,
and recovery after provider or health failures. Provider transport fixtures remain in
tests; production never substitutes them for unavailable live data.
