import React, { useEffect } from 'react';
import aboutMarkup from './aboutMarkup';
import { applyPublishedCms } from './cms/domApply';
import { fetchPublishedContentFromServer } from './cms/storage';

export default function AboutApp() {
  useEffect(() => {
    let isDisposed = false;
    let cleanupAboutInit = null;
    (async () => {
      const remoteContent = await fetchPublishedContentFromServer();
      if (isDisposed) {
        return;
      }
      applyPublishedCms(document, remoteContent || undefined);

      import('./initAbout')
        .then(({ default: initAbout }) => {
          if (!isDisposed) {
            cleanupAboutInit = initAbout();
          }
        })
        .catch(() => {
          // Keep page usable even if menu boot fails.
        });
    })().catch(() => {
      if (!isDisposed) {
        applyPublishedCms(document);
      }
    });

    return () => {
      isDisposed = true;
      if (typeof cleanupAboutInit === 'function') {
        cleanupAboutInit();
      }
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: aboutMarkup }} />;
}
