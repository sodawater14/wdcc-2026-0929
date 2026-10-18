const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function itemHTML(item){
  const children=item.children?.length?`<div class="summary-children">${item.children.map(itemHTML).join('')}</div>`:'';
  return `<details class="summary-item"><summary><span class="summary-label">${escape(item.title)}</span><span class="summary-arrow" aria-hidden="true"></span></summary><div class="summary-body">${item.bodyHtml}${children}</div></details>`;
}

export class PersonalSummary {
  constructor(root,onChange){
    this.root=root;this.onChange=onChange;this.anchors=new WeakMap();this.frame=0;
    const remember=event=>{
      const summary=event.target.closest?.('summary');
      if(summary&&root.contains(summary))this.anchors.set(summary.parentElement,summary.getBoundingClientRect().top);
    };
    root.addEventListener('click',remember,true);
    root.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))remember(event);},true);
    root.addEventListener('toggle',event=>{
      const details=event.target;
      if(!details.matches('.summary-item'))return;
      const top=this.anchors.get(details);this.anchors.delete(details);
      cancelAnimationFrame(this.frame);
      this.frame=requestAnimationFrame(()=>{
        if(!details.isConnected||!root.getClientRects().length)return;
        if(top!==undefined){
          const summary=details.querySelector('summary');
          root.scrollTop+=summary.getBoundingClientRect().top-top;
        }
        this.onChange();
      });
    },true);
  }
  render(sections){
    cancelAnimationFrame(this.frame);this.anchors=new WeakMap();
    this.root.innerHTML=sections.map((section,index)=>{
      let body=section.html;
      if(section.items)body=`<div class="summary-points">${section.items.map(itemHTML).join('')}</div>`;
      else if(section.keywords)body=`<div class="summary-keywords">${section.keywords.map((word,i)=>`<span class="summary-keyword">${escape(word)}${i<section.keywords.length-1?'<span class="sr-only">；</span>':''}</span>`).join('')}</div>`;
      return `<section class="personal-section${index===0?' summary-core':''}"><h2>${escape(section.title)}</h2>${body}</section>`;
    }).join('');
    this.root.scrollTop=0;
  }
}
