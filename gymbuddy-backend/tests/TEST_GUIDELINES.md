# GymBuddy Testing Guidelines

This document outlines best practices for writing and maintaining tests for the GymBuddy application.

## Testing Philosophy

Good tests for GymBuddy should:

1. Be **independent** - No test should depend on another test's execution
2. Be **focused** - Each test should verify one specific behavior
3. Be **reliable** - Tests should produce the same results consistently
4. Be **maintainable** - Tests should be easy to understand and modify
5. Be **fast** - The test suite should run quickly to encourage frequent testing

## Test Types

### Unit Tests

- Test individual functions and methods
- Mock external dependencies
- Focus on logic, not integration points

Example location: `tests/unit/`

### Integration Tests

- Test interactions between components
- Test API endpoints
- Verify database operations

Example location: `tests/api/` (current focus)

### End-to-End Tests

- Test complete user flows
- Simulate real user interactions
- Verify the application works as a whole

Example location: `tests/e2e/` (future addition)

## Test Structure

```javascript
// 1. Import required modules
const request = require('supertest');
const app = require('../server');

// 2. Group related tests
describe('Feature X', () => {
  // 3. Setup before tests
  beforeEach(async () => {
    // Set up test data
  });

  // 4. Individual test case
  test('should do something specific', async () => {
    // 5. Arrange - set up test conditions
    const testData = { key: 'value' };

    // 6. Act - perform the action being tested
    const response = await request(app)
      .post('/api/endpoint')
      .send(testData);

    // 7. Assert - verify expected outcome
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('key');
  });
});
```

## Best Practices

### Naming Conventions

- Test files: `[feature].test.js`
- Test groups: Describe the feature being tested
- Test cases: Begin with "should" and describe expected behavior

### Arrange-Act-Assert Pattern

Structure each test with:

1. **Arrange**: Set up test data and conditions
2. **Act**: Perform the action being tested
3. **Assert**: Verify the expected outcome

### Testing API Endpoints

For each endpoint, test:

1. **Success case**: Valid input produces expected output
2. **Validation**: Invalid input is handled appropriately
3. **Authentication**: Endpoint requires proper authorization
4. **Error handling**: Errors are handled gracefully

### Mocking

- Use mocks for external services (email, third-party APIs)
- Use MongoDB Memory Server for database tests
- Mock time-dependent operations

### Testing Coverage

Aim for:
- Line coverage: >80%
- Branch coverage: >70%
- Function coverage: >90%

## Test Debugging

When tests fail:

1. Read the error message carefully
2. Use console.log() to inspect values
3. Run single tests with `npm test -- -t "test name"`
4. Use Jest's debugging capabilities: `node --inspect-brk node_modules/.bin/jest --runInBand [test file]`

## Common Pitfalls

- **Flaky tests**: Tests that sometimes pass and sometimes fail
  - Solution: Make tests more deterministic, avoid race conditions

- **Slow tests**: Tests that take too long to run
  - Solution: Use in-memory databases, mock external services

- **Brittle tests**: Tests that break when implementation details change
  - Solution: Test behavior, not implementation

- **Overlapping tests**: Tests that interfere with each other
  - Solution: Clean up after each test, use isolated test data