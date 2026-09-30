import { inflateSync } from 'node:zlib';
// Dependency-free real PNG scanline decode for the provided 8-bit RGB/RGBA assets.
export function decodePng(bytes){
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG signature');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25],channels=color===6?4:3;
  if(depth!==8 || ![2,6].includes(color) || bytes[28]!==0)throw Error('Unsupported PNG layout');
  const chunks=[];for(let offset=8;offset<bytes.length;){const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(type==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,out=Buffer.alloc(width*height*4),rows=Buffer.alloc(stride*height);
  if(raw.length!==(stride+1)*height)throw Error('Invalid decompressed length');
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('Invalid PNG filter');
    for(let x=0;x<stride;x++){const a=x>=channels?rows[y*stride+x-channels]:0,b=y?rows[(y-1)*stride+x]:0,c=y&&x>=channels?rows[(y-1)*stride+x-channels]:0;
      const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predict=filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?(pa<=pb&&pa<=pc?a:pb<=pc?b:c):0;
      rows[y*stride+x]=(raw[y*(stride+1)+1+x]+predict)&255;
    }
    for(let x=0;x<width;x++){const i=(y*width+x)*4,j=y*stride+x*channels;out[i]=rows[j];out[i+1]=rows[j+1];out[i+2]=rows[j+2];out[i+3]=channels===4?rows[j+3]:255}
  }
  return {width,height,rgba:out};
}