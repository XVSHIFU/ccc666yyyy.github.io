// Independently implements the publicly observed /projects interactions.
// Reference artwork, shaders, application code and video assets are not copied.
import { StefanMediaWebGL } from './stefan-media-webgl';
class StefanProjects extends HTMLElement {
  private controller?: AbortController;
  private resizeObserver?: ResizeObserver;
  private frame=0;
  private hoverTimer=0;
  private routeTimer=0;
  private animationTimer=0;
  private active=0;
  private currentScroll=0;
  private targetScroll=0;
  private maximumScroll=0;
  private paused=false;
  private motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  private reduced=this.motionPreference.matches;
  private desktop=matchMedia('(min-width: 900px)');
  private links:HTMLAnchorElement[]=[];
  private stories:HTMLElement[]=[];
  private gallery?:HTMLElement;
  private track?:HTMLElement;
  private media?:StefanMediaWebGL;

  connectedCallback(){
    this.controller?.abort();this.controller=new AbortController();const {signal}=this.controller;
    this.links=Array.from(this.querySelectorAll<HTMLAnchorElement>('[data-stefan-select]'));
    this.stories=Array.from(this.querySelectorAll<HTMLElement>('[data-stefan-story]'));
    this.gallery=this.querySelector<HTMLElement>('.stefan-gallery')||undefined;
    this.track=this.querySelector<HTMLElement>('.stefan-gallery-track')||undefined;
    if(this.gallery)this.media=new StefanMediaWebGL(this.gallery);
    this.classList.add('is-enhanced');this.paused=this.reduced;this.syncPause();
    this.motionPreference.addEventListener('change',()=>{
      this.reduced=this.motionPreference.matches;
      if(this.reduced){this.paused=true;this.syncPause();this.currentScroll=this.targetScroll;this.renderScroll()}
    },{signal});
    this.links.forEach((link,index)=>{
      link.addEventListener('pointerenter',()=>{if(!this.desktop.matches)return;clearTimeout(this.hoverTimer);this.hoverTimer=window.setTimeout(()=>this.select(index),80);this.classList.add('has-hovered-link')},{signal});
      link.addEventListener('pointerleave',()=>{clearTimeout(this.hoverTimer);this.classList.remove('has-hovered-link')},{signal});
      link.addEventListener('focus',()=>this.select(index),{signal});
    });
    this.addEventListener('click',event=>this.onClick(event),{signal});
    this.addEventListener('wheel',event=>{
      if(!this.desktop.matches||!this.gallery||document.querySelector('dialog[open]')||event.ctrlKey)return;
      if((event.target as HTMLElement).closest('button,input,textarea'))return;
      event.preventDefault();const factor=event.deltaMode===1?20:event.deltaMode===2?innerHeight:1;
      this.targetScroll=Math.max(0,Math.min(this.maximumScroll,this.targetScroll+event.deltaY*factor));this.startMotion();
    },{signal,passive:false});
    this.gallery?.addEventListener('keydown',event=>{
      if(!this.desktop.matches)return;
      const directions:Record<string,number>={ArrowDown:100,ArrowUp:-100,PageDown:innerHeight*.75,PageUp:-innerHeight*.75,' ':innerHeight*.75};
      if(event.key in directions){event.preventDefault();this.targetScroll=Math.max(0,Math.min(this.maximumScroll,this.targetScroll+directions[event.key]));this.startMotion()}
      if(event.key==='Home'||event.key==='End'){event.preventDefault();this.targetScroll=event.key==='Home'?0:this.maximumScroll;this.startMotion()}
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();this.select((this.active+(event.key==='ArrowRight'?1:-1)+this.stories.length)%this.stories.length)}
    },{signal});
    this.addEventListener('pointermove',event=>{
      if(this.paused||!this.desktop.matches||event.pointerType==='touch')return;
      const box=this.getBoundingClientRect();this.style.setProperty('--cursor-x',`${event.clientX-box.left}px`);this.style.setProperty('--cursor-y',`${event.clientY-box.top}px`);this.classList.add('has-pointer');
    },{signal});
    this.addEventListener('pointerleave',()=>this.classList.remove('has-pointer'),{signal});
    this.querySelector('[data-stefan-previous]')?.addEventListener('click',()=>this.select((this.active-1+this.stories.length)%this.stories.length),{signal});
    this.querySelector('[data-stefan-next]')?.addEventListener('click',()=>this.select((this.active+1)%this.stories.length),{signal});
    this.querySelector('[data-stefan-motion]')?.addEventListener('click',()=>{this.paused=!this.paused;this.syncPause();this.startMotion()},{signal});
    this.desktop.addEventListener('change',()=>this.measure(),{signal});
    this.resizeObserver=new ResizeObserver(()=>this.measure());if(this.gallery)this.resizeObserver.observe(this.gallery);
    this.querySelectorAll('img').forEach(image=>image.addEventListener('load',()=>this.measure(),{signal,once:true}));
    window.addEventListener('pagehide',()=>this.cancelMotion(),{signal});
    window.addEventListener('pageshow',()=>{this.classList.remove('is-leaving');this.querySelector('.stefan-route-curtain')?.remove();this.media?.setPaused(this.paused);this.measure()},{signal});
    requestAnimationFrame(()=>{if(!this.isConnected)return;this.classList.add('is-ready');this.measure();this.playReveal()});
  }

  private measure(){
    if(!this.track||!this.gallery)return;
    const offset=this.desktop.matches?innerHeight*.265:0;
    this.maximumScroll=Math.max(0,offset+(this.stories[this.active]?.scrollHeight||0)-this.gallery.clientHeight+35);
    this.targetScroll=Math.min(this.maximumScroll,this.targetScroll);this.currentScroll=Math.min(this.maximumScroll,this.currentScroll);this.renderScroll();
  }
  private select(index:number){
    if(index===this.active||!this.stories[index])return;
    clearTimeout(this.hoverTimer);clearTimeout(this.animationTimer);
    this.stories[this.active].hidden=true;this.active=index;const story=this.stories[index];story.hidden=false;
    this.links.forEach((link,i)=>link.classList.toggle('is-current',i===index));
    const current=this.querySelector<HTMLElement>('[data-stefan-current]');if(current){current.textContent=String(index+1).padStart(2,'0');if(!this.paused)current.animate([{transform:'translateY(25%)',opacity:.2},{transform:'translateY(0)',opacity:1}],{duration:400,easing:'cubic-bezier(.16,1,.3,1)'})}
    const description=this.querySelector<HTMLElement>('[data-stefan-description]');if(description)description.textContent=story.dataset.description||'';
    const mobileTitle=this.querySelector<HTMLElement>('[data-stefan-mobile-title]');if(mobileTitle)mobileTitle.textContent=story.dataset.title||'';
    const status=this.querySelector<HTMLElement>('[data-stefan-status]');if(status)status.textContent=`预览 ${index+1}/${this.stories.length}：${story.dataset.title}`;
    this.targetScroll=0;this.currentScroll=0;this.cancelMotion();this.measure();this.playReveal();
  }
  private playReveal(){
    const story=this.stories[this.active];if(!story)return;void this.media?.select(story);if(this.paused)return;
    story.classList.remove('is-revealing');void story.offsetWidth;story.classList.add('is-revealing');this.animationTimer=window.setTimeout(()=>story.classList.remove('is-revealing'),1350);
  }
  private startMotion(){
    if(this.paused||!this.desktop.matches){this.currentScroll=this.targetScroll;this.renderScroll();return}
    if(this.frame)return;
    const step=()=>{
      this.frame=0;if(!this.isConnected||document.hidden)return;
      const difference=this.targetScroll-this.currentScroll;this.currentScroll+=difference*.13;
      this.style.setProperty('--scroll-shear',`${Math.max(-1.2,Math.min(1.2,difference*.002))}deg`);this.renderScroll();
      if(Math.abs(difference)>.35)this.frame=requestAnimationFrame(step);else{this.currentScroll=this.targetScroll;this.style.setProperty('--scroll-shear','0deg');this.renderScroll()}
    };this.frame=requestAnimationFrame(step);
  }
  private renderScroll(){if(this.track)this.track.style.transform=this.desktop.matches?`translate3d(0,${innerHeight*.265-this.currentScroll}px,0)`:'none';this.style.setProperty('--counter-opacity',this.desktop.matches?String(Math.max(0,1-this.currentScroll/160)):'1');this.dataset.galleryOffset=this.currentScroll.toFixed(1);this.media?.update(this.targetScroll-this.currentScroll)}
  private cancelMotion(){cancelAnimationFrame(this.frame);this.frame=0;this.style.setProperty('--scroll-shear','0deg')}
  private syncPause(){this.classList.toggle('is-paused',this.paused);this.media?.setPaused(this.paused);const button=this.querySelector<HTMLButtonElement>('[data-stefan-motion]');if(button){button.setAttribute('aria-pressed',String(this.paused));button.setAttribute('aria-label',this.paused?'启用画廊动效':'暂停画廊动效');const label=button.querySelector('span');if(label)label.textContent=this.paused?'启用动效':'暂停动效'}if(this.paused){this.cancelMotion();this.querySelectorAll<HTMLElement>('.is-revealing').forEach(node=>node.classList.remove('is-revealing'));this.classList.remove('has-pointer')}}
  private onClick(event:MouseEvent){
    const link=(event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-stefan-select],a[data-stefan-open]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||this.classList.contains('is-leaving'))return;
    if(this.paused)return;
    event.preventDefault();this.classList.add('is-leaving');this.cancelMotion();this.media?.setPaused(true);
    const curtain=document.createElement('div');curtain.className='stefan-route-curtain';curtain.setAttribute('aria-hidden','true');
    for(let index=0;index<6;index++){const slice=document.createElement('span');slice.style.setProperty('--slice',String(index));curtain.append(slice)}
    this.append(curtain);const destination=new URL(link.href);destination.searchParams.set('theme','stefan');
    this.routeTimer=window.setTimeout(()=>location.assign(destination.href),520);
  }
  disconnectedCallback(){this.controller?.abort();this.resizeObserver?.disconnect();this.cancelMotion();this.media?.destroy();this.media=undefined;clearTimeout(this.hoverTimer);clearTimeout(this.routeTimer);clearTimeout(this.animationTimer)}
}
if(!customElements.get('stefan-projects'))customElements.define('stefan-projects',StefanProjects);
