/* global Buffer */

const baseUtils = require('../../../common/base-utils');

describe('Base Utils', function() {
  it('parseURIParts should be able to parse URIs', function() {
    var parts = baseUtils.parseURIParts('https://localhost:8090/test/derp?hello=world&test=wow+dude#COOL_BEANS');

    expect(parts.host).toBe('localhost:8090');
    expect(parts.hostname).toBe('localhost');
    expect(parts.href).toBe('https://localhost:8090/test/derp?hello=world&test=wow%20dude');
    expect(parts.origin).toBe('https://localhost:8090');
    expect(parts.pathname).toBe('/test/derp');
    expect(parts.port).toBe('8090');
    expect(parts.protocol).toBe('https:');
    expect(parts.schema).toBe('https');
    expect(parts.hash).toBe('COOL_BEANS');
    expect(parts.params.hello).toBe('world');
    expect(parts.params.test).toBe('wow dude');

    parts = baseUtils.parseURIParts('tty:///dev/ttyUSB0?baudRate=230400&dataBits=8&stopBits=1&parity=none&rtscts=false&xon=false&xoff=false&xany=false#COOL_BEANS');

    expect(parts.resource).toBe('/dev/ttyUSB0');
    expect(parts.host).toBeUndefined();
    expect(parts.hostname).toBeUndefined();
    expect(parts.href).toBeUndefined();
    expect(parts.origin).toBeUndefined();
    expect(parts.pathname).toBeUndefined();
    expect(parts.port).toBeUndefined();
    expect(parts.protocol).toBe('tty:');
    expect(parts.schema).toBe('tty');
    expect(parts.hash).toBe('COOL_BEANS');
    expect(parts.params.baudRate).toBe('230400');
    expect(parts.params.dataBits).toBe('8');
    expect(parts.params.stopBits).toBe('1');
    expect(parts.params.parity).toBe('none');
    expect(parts.params.rtscts).toBe('false');
    expect(parts.params.xon).toBe('false');
    expect(parts.params.xoff).toBe('false');
    expect(parts.params.xany).toBe('false');

    parts = baseUtils.parseURIParts('tty:///dev/ttyUSB0?baudRate=230400&dataBits=8&stopBits=1&parity=none&rtscts=false&xon=false&xoff=false&xany=false#COOL_BEANS', { convertParams: true });

    expect(parts.resource).toBe('/dev/ttyUSB0');
    expect(parts.host).toBeUndefined();
    expect(parts.hostname).toBeUndefined();
    expect(parts.href).toBeUndefined();
    expect(parts.origin).toBeUndefined();
    expect(parts.pathname).toBeUndefined();
    expect(parts.port).toBeUndefined();
    expect(parts.protocol).toBe('tty:');
    expect(parts.schema).toBe('tty');
    expect(parts.hash).toBe('COOL_BEANS');
    expect(parts.params.baudRate).toBe(230400);
    expect(parts.params.dataBits).toBe(8);
    expect(parts.params.stopBits).toBe(1);
    expect(parts.params.parity).toBe('none');
    expect(parts.params.rtscts).toBe(false);
    expect(parts.params.xon).toBe(false);
    expect(parts.params.xoff).toBe(false);
    expect(parts.params.xany).toBe(false);

    parts = baseUtils.parseURIParts('jdbc:sqlite:///home/wyatt/.config/music-studio/music-studio.sqlite?hello=world&stuff=true&rate=2453#COOL_BEANS', { convertParams: true });

    expect(parts.resource).toBe('/home/wyatt/.config/music-studio/music-studio.sqlite');
    expect(parts.host).toBeUndefined();
    expect(parts.hostname).toBeUndefined();
    expect(parts.href).toBeUndefined();
    expect(parts.origin).toBeUndefined();
    expect(parts.pathname).toBeUndefined();
    expect(parts.port).toBeUndefined();
    expect(parts.protocol).toBe('jdbc:');
    expect(parts.schema).toBe('jdbc');
    expect(parts.subProtocol).toBe('sqlite:');
    expect(parts.subSchema).toBe('sqlite');
    expect(parts.hash).toBe('COOL_BEANS');
    expect(parts.params.hello).toBe('world');
    expect(parts.params.stuff).toBe(true);
    expect(parts.params.rate).toBe(2453);
  });
});
