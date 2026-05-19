import React, { useEffect } from 'react';
import homeMarkup from './homeMarkup';

export default function HomeApp() {
  useEffect(() => {
    let isDisposed = false;

    import('./initSite')
      .then(({ default: initSite }) => {
        if (!isDisposed) {
          initSite();
        }
      })
      .catch(() => {
        // Keep the page usable even if optional interactive boot fails.
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: homeMarkup }} />;
}
