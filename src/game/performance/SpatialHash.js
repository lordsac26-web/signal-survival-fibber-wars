export default class SpatialHash{
  constructor(cell=96,maxBuckets=512){this.cell=cell;this.cols=1;this.rows=1;this.buckets=Array.from({length:maxBuckets},()=>[])}
  resize(w,h){this.cols=Math.ceil(w/this.cell)+2;this.rows=Math.ceil(h/this.cell)+2;const need=this.cols*this.rows;while(this.buckets.length<need)this.buckets.push([])}
  clear(){const n=this.cols*this.rows;for(let i=0;i<n;i++)this.buckets[i].length=0}
  key(x,y){const c=Math.max(0,Math.min(this.cols-1,(x/this.cell|0)+1)),r=Math.max(0,Math.min(this.rows-1,(y/this.cell|0)+1));return r*this.cols+c}
  insert(o){this.buckets[this.key(o.x,o.y)].push(o)}
  visit(x,y,r,fn){const x0=Math.max(0,(x-r)/this.cell|0),x1=Math.min(this.cols-1,(x+r)/this.cell+1|0),y0=Math.max(0,(y-r)/this.cell|0),y1=Math.min(this.rows-1,(y+r)/this.cell+1|0);for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const b=this.buckets[cy*this.cols+cx];for(let i=0;i<b.length;i++)fn(b[i])}}
}