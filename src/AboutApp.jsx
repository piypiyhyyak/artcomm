import React, { useEffect } from 'react';
import aboutMarkup from './aboutMarkup';
import { applyPublishedCms } from './cms/domApply';

export default function AboutApp() {
  useEffect(() => {
    applyPublishedCms(document);
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: aboutMarkup }} />;
}
