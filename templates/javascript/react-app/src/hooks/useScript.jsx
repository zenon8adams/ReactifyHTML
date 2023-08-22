import { useState, useEffect } from 'react';

function useScript(scriptUrls) {
  const [loadedScripts, setLoadedScripts] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const allScripts = (Array.isArray(scriptUrls) ? scriptUrls : [scriptUrls]); 
    const promises = allScripts.map((src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.type = 'text/javascript';

        const onLoad = () => {
          resolve(src);
        };

        const onError = () => {
          reject(src);
        };

        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);

        document.body.appendChild(script);
      });
    });

    Promise.all(promises)
      .then((scripts) => {
        setLoadedScripts(scripts);
      })
      .catch(() => {
        setError(true);
      });

    return () => {
        allScripts.forEach((src) => {
        const script = document.querySelector(`script[src="${src}"]`);
        if (script) {
          document.body.removeChild(script);
        }
      });
    };
  }, [scriptUrls]);

  return [loadedScripts, error];
}

export default useScript;
