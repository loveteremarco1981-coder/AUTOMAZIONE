(function(){
  function update(){
    const b = document.getElementById("stateBanner");
    if(!b) return;

    const txt = (b.textContent||"").toUpperCase();

    document.body.classList.remove("comfy","security");

    if(txt.includes("COMFY")) document.body.classList.add("comfy");
    if(txt.includes("SECURITY")) document.body.classList.add("security");
  }

  new MutationObserver(update)
    .observe(document.getElementById("stateBanner"), { childList:true });

  document.addEventListener("DOMContentLoaded",update);
})();