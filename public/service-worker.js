const FILES_TO_CACHE = [
  '/',
  '/manifest.json',
  '/index.html',
  '/index.js',
  '/styles.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@2.8.0',
];

let db;
const request = indexedDB.open('budgettrack',1);
request.onupgradeneeded = function(e) {
  db = e.target.result;
  db.createObjectStore('pending', {autoIncrement: true });
};
request.onsuccess = function(e){
  db = e.target.result;
  if(navigator.onLine){checkDB();}
}
request.onerror = function(e){
  console.log("IDB ERROR: "+e.target.errorCode)
}
function saveRecord(r){
  const transaction = db.transaction(['pending'], "readwrite");
  const store = transaction.objectStore('pending');
  store.add(r);
}
function checkDB(){
  const transaction = db.transaction(['pending'], "readwrite");
  const store = transaction.objectStore('pending');
  const getAll = store.getAll();
  getAll.onsuccess = function(){
    if (getAll.result.length > 0){
      console.log('bulk offline load',getAll)
      fetch('/api/transaction/bulk',{method: 'POST', 
        headers:{Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json'}, body: JSON.stringify(getAll.result)})
      .then(res => res.json())
      .then(()=>{
        const transaction = db.transaction(['pending'], 'readwrite');
        const store = transaction.objectStore('pending');
        store.clear();
      })
    }
  }
}

const PRECACHE = 'precache-v1';
const RUNTIME = 'runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(self.skipWaiting())
  );
});

// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.open(RUNTIME).then(cache =>{
        return fetch(event.request)
        .then(response => {
          // If the response was good, clone it and store it in the cache.
          if (response.status === 200) {
            cache.put(event.request.url, response.clone());
          }

          return response;
        })
        .catch(err => {
          // Network request failed, try to get it from the cache.
          return cache.match(event.request);
        });
        

      })
    )

  }else
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return caches.open(RUNTIME).then((cache) => {
          return fetch(event.request).then((response) => {
            return cache.put(event.request, response.clone()).then(() => {
              return response;
            });
          });
        });
      })
    );
  }
});

//window.
self.addEventListener('online', checkDB);