# React Test

Run React tests with React Testing Library.

## Usage
/react-test [filter] [--coverage]

## Steps
1. Run all tests (non-interactive): `npm test -- --watchAll=false`
2. Run specific file: `npm test -- --watchAll=false src/components/Button.test.tsx`
3. Run by name filter: `npm test -- --watchAll=false -t "renders correctly"`
4. Coverage: `npm test -- --coverage --watchAll=false`

## Reading output
- Pass: `Tests: X passed, X total`
- Fail: shows component name, test description, diff of expected vs received
- Coverage: table shows Stmts/Branch/Funcs/Lines per file

## Testing patterns
- Render: `render(<Component prop="value" />)`
- Query: `screen.getByRole('button', { name: /submit/i })`
- Async: `await screen.findByText('loaded')` for async state
- User events: `await userEvent.click(screen.getByRole('button'))`
- Mocking: `jest.mock('../api/service')` at top of test file

## Required coverage per component
- Renders without crash
- Renders correct content for each significant prop
- User interactions trigger expected callbacks
- Loading and error states render correct UI
