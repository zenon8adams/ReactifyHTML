import { Helmet } from 'react-helmet-async';
@{REACT_IMPORT}
@{STYLE_INCLUDE}
function @{PAGE_NAME}() {
    @{USE_IMPORT}

  return (<>
            <Helmet><title>@{TITLE_CONTENT}</title></Helmet>
            <Helmet>@{META_CONTENT}</Helmet>
            <Helmet>@{LINK_CONTENT}</Helmet>
                    @{PAGE_CONTENT}
            <Loader>@{PAGE_SCRIPT}</Loader>
          </>);
}

export default @{PAGE_NAME};
