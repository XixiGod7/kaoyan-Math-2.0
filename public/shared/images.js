(() => {
  window.createStudyImagePicker = (element, options = {}) => {
    let ids = [...(options.ids || [])], busy = false;
    element.className += ' study-images';
    element.tabIndex=0;element.setAttribute('aria-label','图片附件，可粘贴或拖入图片');
    element.innerHTML = '<div class="study-images-list"></div><label class="study-images-upload">＋ 上传图片<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><small class="study-images-status" role="status">PNG / JPEG / WebP · 可粘贴或拖入 · 最多 3 张</small>';
    const input=element.querySelector('input'),list=element.querySelector('.study-images-list'),status=element.querySelector('.study-images-status');
    function notify() { element.dispatchEvent(new Event('study:images')); options.onChange?.([...ids]); }
    function preview(id) {
      const box=document.createElement('div');box.className='study-image';
      const img=document.createElement('img');img.src='/api/qa/image/'+id;img.alt='待发送的图片';
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','移除图片');
      remove.onclick=async()=>{if(busy)return;try{const r=await fetch('/api/qa/image/'+id,{method:'DELETE'});if(!r.ok)throw new Error();ids=ids.filter(x=>x!==id);box.remove();notify();}catch{status.textContent='移除失败，请重试';}};
      box.append(img,remove);list.append(box);
    }
    ids.forEach(preview);
    async function upload(files) {
      if(busy)return;const candidates=[...files];if(!candidates.length)return;
      if(ids.length+candidates.length>3){status.textContent='每次最多上传 3 张图片';return;}
      if(candidates.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type) || f.size>5*1024*1024)){status.textContent='请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片';return;}
      busy=true;element.dataset.uploading='true';input.disabled=true;status.textContent='正在上传…';
      try {for(const file of candidates){const form=new FormData();form.append('file',file);const r=await fetch('/api/qa/image',{method:'POST',body:form});const value=await r.json();if(!r.ok || !value.ok)throw new Error(value.message || '上传失败');ids.push(value.id);preview(value.id);notify();}status.textContent='图片已上传，将与本次文字一起发送';}
      catch(e){status.textContent=e.message+'，请重试';}
      finally{busy=false;delete element.dataset.uploading;input.disabled=false;input.value='';notify();}
    }
    input.onchange=()=>upload(input.files);
    element.parentElement.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files || [])];if(files.length){e.preventDefault();upload(files);}});
    element.addEventListener('dragover',e=>e.preventDefault());element.addEventListener('drop',e=>{e.preventDefault();upload(e.dataTransfer.files);});
    return {ids:()=>[...ids],busy:()=>busy,clear:()=>{for(const id of ids)fetch('/api/qa/image/'+id,{method:'DELETE'}).catch(()=>{});ids=[];list.replaceChildren();notify();}};
  };
})();
