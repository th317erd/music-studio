import { createResolvable } from '@common/base-utils.js';

var messageIDCounter  = 1,
    pendingMessages   = {};

export function handleMessage(event, handlers) {
  if (!handlers)
    return;

  var data = event.data,
      handler;

  if (!data)
    return;

  var eventName = data.eventName;
  if (!handlers.hasOwnProperty(eventName))
    return;

  var defaultHandlers = {
    '_resolveMessage': (messageID, error, result) => {
      var promise = pendingMessages[messageID];
      if (!promise)
        return;

      if (error) {
        promise.reject(error);
      } else {
        promise.resolve(result);
      }

      delete pendingMessages[messageID];
    }
  };

  // Try default message handlers first
  handler = defaultHandlers[eventName];
  if (typeof handler === 'function')
    return handler.apply(this, data.args);

  // Try customer message handlers second
  handler = handlers[eventName];
  if (typeof handler === 'function')
    return handler.apply(this, data.args);
}

export function sendMessage(worker, eventName, _args) {
  var args      = _args || [],
      messageID = messageIDCounter++,
      payload   = { eventName, args, id: messageID },
      promise   = createResolvable();

  pendingMessages[messageID] = promise;

  if (worker)
      worker.postMessage(payload);
    else
      postMessage(payload);

  return promise;
}
