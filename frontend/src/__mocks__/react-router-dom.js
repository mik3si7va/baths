const React = require('react');

let currentPath = '/';
let setCurrentPath = null;

// MemoryRouter
const MemoryRouter = ({ children, initialEntries }) => {
    const [path, setPath] = React.useState(
        initialEntries && initialEntries.length > 0 ? initialEntries[0] : '/'
    );

    currentPath = path;
    setCurrentPath = setPath;

    return React.createElement(React.Fragment, null, children);
};

// Route matching
function matchPath(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }

    return params;
}

// Routes
const Routes = ({ children }) => {
    const childArray = React.Children.toArray(children);

    for (const child of childArray) {
        const path = child.props.path;
        if (!path) continue;

        const match = matchPath(path, currentPath);
        if (match) {
            return React.cloneElement(child.props.element);
        }
    }

    return null;
};

// Route
const Route = ({ element }) => element;

// Hooks
const useParams = () => {
    const patterns = [
        '/salas/:id/:nome',
        '/salas/:id',
        '/:id/:nome',
        '/:id',
    ];

    for (const pattern of patterns) {
        const match = matchPath(pattern, currentPath);
        if (match && Object.keys(match).length > 0) return match;
    }

    return {};
};

const useNavigate = () => (to) => {
    if (setCurrentPath) {
        currentPath = to;
        setCurrentPath(to);
    }
};

const useLocation = () => ({
    pathname: currentPath,
    search: '',
    hash: '',
    state: null,
});

const useMatch = () => null;

const useSearchParams = () => [new URLSearchParams(), jest.fn()];

// Components
const Link = ({ children, to }) =>
    React.createElement('a', { href: to }, children);

const NavLink = ({ children, to }) =>
    React.createElement('a', { href: to }, children);

const Outlet = () => null;

// Export
module.exports = {
    MemoryRouter,
    Routes,
    Route,
    Link,
    NavLink,
    Outlet,
    useNavigate,
    useParams,
    useLocation,
    useMatch,
    useSearchParams,
};
