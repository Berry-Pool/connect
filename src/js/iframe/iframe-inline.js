window.parent.postMessage(
    {
        event: 'UI_EVENT',
        type: 'iframe-bootstrap',
    },
    '*',
);

const iframeScript = document.createElement('script');
iframeScript.setAttribute('type', 'text/javascript');
iframeScript.setAttribute('src', './js/iframe.2f035b0e0d3a98f22207.js');
iframeScript.setAttribute('async', 'false');
document.body.appendChild(iframeScript);
