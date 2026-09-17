export default class ObjectPool{
  constructor(size,factory){this.items=new Array(size);this.free=new Int32Array(size);this.freeCount=size;for(let i=0;i<size;i++){this.items[i]=factory(i);this.free[i]=size-1-i}}
  acquire(){if(!this.freeCount)return null;const o=this.items[this.free[--this.freeCount]];o.active=true;return o}
  release(o){if(!o.active)return;o.active=false;this.free[this.freeCount++]=o.poolIndex}
  each(fn){const a=this.items;for(let i=0;i<a.length;i++)if(a[i].active)fn(a[i],i)}
}