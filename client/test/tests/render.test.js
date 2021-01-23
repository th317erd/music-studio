import React            from 'react';
import ReactDOM         from 'react-dom';
import { Application }  from '../../source/application';

describe('Application Component', function() {
  it('renders without crashing', function() {
    const div = document.createElement('div');
    ReactDOM.render(React.createElement(Application, {}), div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
