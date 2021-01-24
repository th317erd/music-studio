import { handleMessage, sendMessage } from './worker-utils';

console.log('HELLO FROM WORKER!');

onmessage = function(event) {
  handleMessage(event, {
    'log': (message) => {
      console.log('Main thread requested that I log: ', message);
    }
  });
};

sendMessage(null, 'ready');
