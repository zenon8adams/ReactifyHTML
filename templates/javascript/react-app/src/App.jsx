import logo from './logo.svg';
import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Routes, Route, useNavigationType, useLocation } from 'react-router-dom';
import Router from './navigator/routes';
@{ROUTES_INCLUDE}

function App() {
    const action = useNavigationType();
    const location = useLocation();
    const pathname = location.pathname;

    useEffect(() => {
        if (action !== 'POP') {
            window.scrollTo(0, 0);
        }
    }, [action, pathname]);

    return (<HelmetProvider>
                <Routes>
            	    @{ROUTES_CONTENT}
                </Routes>
            </HelmetProvider>
    );
}


export default App;
