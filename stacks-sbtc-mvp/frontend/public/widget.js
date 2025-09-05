(function(){
  function resolveBase(){
    var base = (typeof window !== 'undefined' && (window.__STACKSPAY_WIDGET_BASE__ || window.__SBTC_WIDGET_BASE__)) || '';
    if(!base){
      try { base = location.origin; } catch(e) {}
    }
    if(!base){ base = 'http://localhost:3000'; }
    return String(base).replace(/\/$/,'');
  }

  function findContainer(config){
    if(config && config.container){
      var el = document.getElementById(config.container) || document.querySelector(config.container);
      if(el) return el;
    }
    var fallback = document.getElementById('stackspay-payment-widget') || document.getElementById('sbtc-payment-widget');
    if(fallback) return fallback;
    var div = document.createElement('div');
    div.id = 'stackspay-payment-widget';
    document.body.appendChild(div);
    return div;
  }

  function encodeConfig(config){
    try {
      return encodeURIComponent(JSON.stringify(config || {}));
    } catch(e) {
      return encodeURIComponent('{}');
    }
  }

  function render(config){
    var container = findContainer(config);
    var base = resolveBase();
    var iframe = document.createElement('iframe');
    iframe.src = base + '/widget?c=' + encodeConfig(config);
    iframe.style.width = (config && config.width) || '100%';
    iframe.style.border = '0';
    iframe.style.background = 'transparent';
    // Height: use explicit if provided, else start with 520px and auto-resize via postMessage
    var h = (config && config.height) || '520px';
    iframe.style.height = h;
    container.innerHTML = '';
    container.appendChild(iframe);

    // Auto-resize support
    function onMessage(ev){
      try {
        var data = ev.data;
        if(!data || typeof data !== 'object') return;
        if((data.type === 'stackspay-widget-size' || data.type === 'sbtc-widget-size') && ev.source === iframe.contentWindow){
          if(data.height){
            iframe.style.height = data.height + 'px';
          }
        }
      } catch(e){}
    }
    window.addEventListener('message', onMessage);
  }

  // Expose global render function used by WidgetLoader
  window.renderStacksPayWidget = render;
  window.renderSBTCWidget = window.renderSBTCWidget || render; // backward compat
  window.StacksPayWidget = window.StacksPayWidget || {};
  window.StacksPayWidget.init = function(config){
    try { render(config || {}); } catch(e) { /* swallow */ }
  };
  // Backward compatibility
  window.SBTCPaymentWidget = window.SBTCPaymentWidget || {};
  window.SBTCPaymentWidget.init = function(config){
    try { render(config || {}); } catch(e) { /* swallow */ }
  };
})();
