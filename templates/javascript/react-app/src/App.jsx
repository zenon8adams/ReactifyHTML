import logo from './logo.svg';
import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Routes, Route, useNavigationType, useLocation } from 'react-router-dom';
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

    useEffect(() => {
        let title = '';
        let metaDescription = '';

        switch (pathname) {
            @{CASE_PAGE_INFO}
        }

        if (title) {
            document.title = title;
        }

        if (metaDescription) {
            const metaDescriptionTag = document.querySelector(
                'head > meta[name="description"]'
            );
            if (metaDescriptionTag) {
                metaDescriptionTag.content = metaDescription;
            }
        }
    }, [pathname]);
    
    return (<HelmetProvider>
                <Routes>
            	    @{ROUTES_CONTENT}
                </Routes>
            </HelmetProvider>
    );
}


export default App;
