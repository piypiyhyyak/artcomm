import React, { useEffect } from 'react';
import homeMarkup from './homeMarkup';
import { applyPublishedCms } from './cms/domApply';
import { fetchPublishedContentFromServer } from './cms/storage';

export default function HomeApp() {
  useEffect(() => {
    let isDisposed = false;
    (async () => {
      const remoteContent = await fetchPublishedContentFromServer();
      if (isDisposed) {
        return;
      }
      applyPublishedCms(document, remoteContent || undefined);

      import('./initSite')
        .then(({ default: initSite }) => {
          if (!isDisposed) {
            initSite();
          }
        })
        .catch(() => {
          // Keep the page usable even if optional interactive boot fails.
        });
    })().catch(() => {
      if (!isDisposed) {
        applyPublishedCms(document);
      }
    });

    return () => {
      isDisposed = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: homeMarkup }} />;
}
