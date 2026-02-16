(() => {
  const { popcount32 } = window.SimUtils;
  class Bitset2D{
    constructor(w,h){
      this.w=w; this.h=h; this.n=w*h;
      this.words = new Uint32Array((this.n + 31) >>> 5);
    }
    index(x,y){ return y*this.w + x; }
    getByIndex(i){ const wi=i>>>5, bi=i&31; return (this.words[wi]>>>bi)&1; }
    setByIndex(i){ const wi=i>>>5, bi=i&31; this.words[wi] |= (1<<bi); }
    clearByIndex(i){ const wi=i>>>5, bi=i&31; this.words[wi] &= ~(1<<bi); }
    clearAll(){ this.words.fill(0); }
    andInto(other,out){
      const a=this.words,b=other.words,o=out.words;
      for(let i=0;i<o.length;i++) o[i]=a[i]&b[i];
      return out;
    }
    andNotInPlace(mask){
      const a=this.words,m=mask.words;
      for(let i=0;i<a.length;i++) a[i] &= ~m[i];
      return this;
    }
    popcount(){
      let t=0; const a=this.words;
      for(let i=0;i<a.length;i++) t += popcount32(a[i]);
      return t;
    }
    forEachSetBit(cb,maxIters=1e9){
      const a=this.words; let emitted=0;
      for(let wi=0;wi<a.length;wi++){
        let word=a[wi];
        while(word){
          const lsb = word & -word;
          const bi = (Math.clz32(lsb) ^ 31);
          const i = (wi<<5) + bi;
          if(i < this.n) cb(i);
          word ^= lsb;
          emitted++; if(emitted>=maxIters) return;
        }
      }
    }
  }
  window.Bitset2D = Bitset2D;
})();
