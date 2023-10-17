import {useNavigate} from 'react-router-dom';

export function navigateTo(event, page) {
    event.preventDefault();
    navigate(page);
};
