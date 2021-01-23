import React                from 'react';
import ReactDOM             from 'react-dom';
import { Application }      from './application';
import developerSession     from './developer-session';

(function() {
  ReactDOM.render(
    <Application
      onReady={(app) => {
        if (developerSession && typeof developerSession.onAppReady === 'function')
          developerSession.onAppReady(app);
      }}
    />,
    document.getElementById('root')
  );
})();
