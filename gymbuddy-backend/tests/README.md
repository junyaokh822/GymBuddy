# GymBuddy Test Suite

This directory contains automated tests for the GymBuddy application.

## Getting Started

To run the tests, you need to have Node.js and npm installed.

### Installing Dependencies

First, install all the required dependencies:

```bash
npm install
```

This will install both the application dependencies and the development dependencies needed for testing.

### Running Tests

To run all tests once:

```bash
npm test
```

To run tests in watch mode (tests will automatically rerun when files change):

```bash
npm run test:watch
```

To run tests with coverage reporting:

```bash
npm run test:coverage
```

After running this command, a `coverage` directory will be created with detailed reports about test coverage.

## Test Structure

The tests are organized by API endpoints:

- **Auth API**: Tests for user registration, login, and token validation
- **Calendar API**: Tests for creating, retrieving, and managing calendar events
- **User Preferences API**: Tests for updating and retrieving user preferences
- **Matching API**: Tests for finding compatible gym buddies
- **Messaging API**: Tests for sending and retrieving messages between users

## Test Environment

Tests run in an isolated environment with:

- An in-memory MongoDB database (no need for a real MongoDB instance)
- Mocked email functionality
- JWT token generation with a test secret

## Adding New Tests

To add a new test, follow these patterns:

1. Group related tests in a `describe` block
2. Before each test, set up necessary data
3. Write concise, focused test cases
4. Use clear assertions with descriptive messages

Example:

```javascript
describe('Feature X', () => {
  beforeEach(async () => {
    // Set up test data
  });

  test('should do something expected', async () => {
    // Test code
    expect(result).toBe(expectedValue);
  });
});
```