import {useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';

export function useNavigator() {
    const prevLocation    = useLocation().pathname;
    const navigate        = useNavigate();
    const [page, setPage] = useState(prevLocation);
    useEffect(() => {
        if (prevLocation !== page) {
            navigate(page);
        }
    }, [page]);
    return (event, page) => {
        event.preventDefault();
        setPage(page);
    };
};
