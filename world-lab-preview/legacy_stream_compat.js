/* Legacy Safari compatibility: async iteration of decompressed ReadableStreams.
 * Kokoro's phonemizer iterates a DecompressionStream readable. Older WebKit
 * implementations expose getReader() but no Symbol.asyncIterator.
 * Do not replace native iteration when it is already supported.
 */
(function () {
  'use strict';
  if (typeof ReadableStream === 'undefined' ||
      typeof Symbol === 'undefined' || !Symbol.asyncIterator ||
      ReadableStream.prototype[Symbol.asyncIterator]) return;
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    var reader = this.getReader();
    try {
      while (true) {
        var result = await reader.read();
        if (result.done) return;
        yield result.value;
      }
    } finally {
      try { await reader.cancel(); } catch (_) {}
      reader.releaseLock();
    }
  };
  console.info('[Legacy] Safari ReadableStream async iterator compatibility enabled');
})();
