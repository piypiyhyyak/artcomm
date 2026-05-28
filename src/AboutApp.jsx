import React, { useEffect } from 'react';
import aboutMarkup from './aboutMarkup';
import { applyPublishedCms } from './cms/domApply';
import { fetchPublishedContentFromServer } from './cms/storage';

export default function AboutApp() {
  useEffect(() => {
    let isDisposed = false;
    (async () => {
      const remoteContent = await fetchPublishedContentFromServer();
      if (isDisposed) {
        return;
      }
      applyPublishedCms(document, remoteContent || undefined);
    })().catch(() => {
      if (!isDisposed) {
        applyPublishedCms(document);
      }
    });

    return () => {
      isDisposed = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: aboutMarkup }} />;
}
