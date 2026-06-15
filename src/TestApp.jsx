import React, { useEffect } from "react";
import testMarkup from "./testMarkup";

export default function TestApp() {
  useEffect(() => {
    import("./initTestPage")
      .then(({ default: initTestPage }) => {
        initTestPage();
      })
      .catch(() => {
        // The page remains readable even if the optional test logic fails to boot.
      });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: testMarkup }} />;
}
