import React from 'react';
import aboutMarkup from './aboutMarkup';

export default function AboutApp() {
  return <div dangerouslySetInnerHTML={{ __html: aboutMarkup }} />;
}
