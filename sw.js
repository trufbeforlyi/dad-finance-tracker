/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-5a5d9309'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "5ef048ddd75ec4d2aa4074264c13c10e"
  }, {
    "url": "index.html",
    "revision": "e82a9722aa30a732a03973d8c06387b3"
  }, {
    "url": "icons.svg",
    "revision": "3b4fcfcf393eca4d264dca4a4663bc37"
  }, {
    "url": "icon-512.svg",
    "revision": "0001e517963856275ae45442a15e96f7"
  }, {
    "url": "icon-512.png",
    "revision": "3e8db07cc1939ba0f20bc31a741fb756"
  }, {
    "url": "icon-192.svg",
    "revision": "0001e517963856275ae45442a15e96f7"
  }, {
    "url": "icon-192.png",
    "revision": "ebc9efe84e9e8db7cc62ae72ee881f4f"
  }, {
    "url": "favicon.svg",
    "revision": "92b722672e7cd864fc0008123c34daab"
  }, {
    "url": "assets/index-CBQmGVGQ.js",
    "revision": null
  }, {
    "url": "assets/index-9_yLcWXF.css",
    "revision": null
  }, {
    "url": "favicon.svg",
    "revision": "92b722672e7cd864fc0008123c34daab"
  }, {
    "url": "icon-192.png",
    "revision": "ebc9efe84e9e8db7cc62ae72ee881f4f"
  }, {
    "url": "icon-512.png",
    "revision": "3e8db07cc1939ba0f20bc31a741fb756"
  }, {
    "url": "manifest.webmanifest",
    "revision": "330f50fa0b146bf2d56afb22e6c91a0c"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
