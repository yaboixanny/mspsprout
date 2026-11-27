<script>
(function(){
  var links=document.querySelectorAll('.toc a');
  if(!links.length)return;
  var heads=[].slice.call(document.querySelectorAll('.post-content h2[id]'));
  var map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a;});
  function update(){
    var current=heads[0]&&heads[0].id;
    heads.forEach(function(h){if(h.getBoundingClientRect().top<=140)current=h.id;});
    links.forEach(function(a){a.classList.remove('active');});
    if(map[current])map[current].classList.add('active');
  }
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update);
  update();
})();
</script>
