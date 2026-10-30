// Offline JSX render-tree checks. No browser, device, API or real network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const React=require('react');
const babel=require('@babel/core');
const fixture=require('../preview/mockApi');
const source=fs.readFileSync(path.join(__dirname,'../screens/DashboardScreen.js'),'utf8');
const code=babel.transformSync(source,{babelrc:false,configFile:false,
  plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;

function render(width,step,quoteState={}) {
  let index=0;
  const react={...React,useEffect:()=>{},useRef:value=>({current:value}),
    useState:initial=>{
      const current=index++;
      const value=current===0 ? step : initial && typeof initial==='object' && 'accepted' in initial ? {...initial,...quoteState} : initial;
      return [value,()=>{}];
    }};
  const rn={StyleSheet:{create:value=>value},Platform:{OS:'web'},useWindowDimensions:()=>({width}),Linking:{openURL:async()=>{}}};
  for(const name of ['Text','View','SafeAreaView','ScrollView','TouchableOpacity','TextInput','KeyboardAvoidingView','StatusBar','Image']) rn[name]=name;
  const module={exports:{}};
  const imports={'react':react,'react-native':rn,'../lib/api':{history:async()=>[],logout:async()=>{}},
    '../lib/quoteFlow':require('../lib/quoteFlow'),'expo-crypto':{randomUUID:()=>{throw Error('Rendering cannot submit')}}};
  vm.runInNewContext(code,{module,exports:module.exports,Date,setInterval,clearInterval,
    require:name=>{if(name.endsWith('.png'))return 1;if(!imports[name])throw Error('Unexpected import');return imports[name];}});
  return module.exports.default({navigation:{replace:()=>{}}});
}
function nodes(tree) {
  if(!React.isValidElement(tree))return [];
  return [tree,...React.Children.toArray(tree.props.children).flatMap(nodes)];
}
function text(tree) {
  if(typeof tree==='string'||typeof tree==='number')return String(tree);
  return React.isValidElement(tree)?React.Children.toArray(tree.props.children).map(text).join(' '):'';
}
test('dashboard style definitions remain unchanged, including desktop fix and mobile styles',()=>{
  const styles=source.slice(source.indexOf('const styles = StyleSheet.create(')).replace(/\r\n/g,'\n').replace(/\n+$/,'');
  assert.equal(crypto.createHash('sha256').update(styles).digest('hex'),'d7ac04783677bc359eaae0e406c8d4b9edda7fca4a4a24c7bf390435d0e45b87');
});
test('desktop retains left sidebar and main-column layout without simulation banner',()=>{
  const root=render(1280,1);
  const [sidebar,main]=React.Children.toArray(root.props.children);
  assert.equal(sidebar.props.style.width,250);assert.equal(sidebar.props.style.flexShrink,0);
  assert.equal(main.props.style.flex,1);assert.equal(main.props.style.minWidth,0);
  assert.doesNotMatch(text(React.Children.toArray(main.props.children)[0]),/SIMULATION ONLY/);
});
test('mobile retains keyboard/scroll hierarchy and every existing wizard/history step renders',()=>{
  for(const step of [1,2,3,4,5,6,7]){
    const root=render(375,step);
    assert.equal(root.type,'SafeAreaView');
    assert.ok(nodes(root).some(node=>node.type==='KeyboardAvoidingView'));
    assert.ok(nodes(root).some(node=>node.type==='ScrollView'));
  }
});
test('desktop and mobile quote views display server amounts, dates, expiry and linked attribution',async()=>{
  const quote=await fixture.quote({recipient_name:'Synthetic',gross_amount:'1000.00'});
  for(const width of [375,1280]){
    const step3=render(width,3,{quote,accepted:true});const content3=text(step3).replace(/\s+/g,' ');
    assert.match(content3,/90\.00000000/);assert.match(content3,/3% fee: INR 30\.00/);
    assert.match(content3,/Net INR: 970\.00/);assert.match(content3,/USD payout: 10\.78/);
    assert.match(content3,/Quote expires/);
    for(const step of [3,4,5]){
      const root=render(width,step,{quote,accepted:true});const content=text(root).replace(/\s+/g,' ');
      assert.match(content,/90\.00000000/);
      const link=nodes(root).find(node=>node.props.accessibilityRole==='link');
      assert.equal(link.props.href,'https://www.exchangerate-api.com');
      assert.match(text(link),/Rates By Exchange Rate API/);
    }
  }
});
test('missing and expired quotes disable accept on desktop and mobile',async()=>{
  const quote=await fixture.quote({recipient_name:'Synthetic',gross_amount:'1000.00'});
  for(const width of [375,1280])for(const state of [{},{quote,expired:true}]){
    const root=render(width,3,state);
    const button=nodes(root).find(node=>node.type==='TouchableOpacity'&&(text(node)==='Proceed'||text(node)==='Accept quote and proceed'));
    assert.equal(button.props.disabled,true);
  }
});
test('pending outcome displays recovery action on desktop and mobile',()=>{
  for(const width of [375,1280]){
    const content=text(render(width,4,{pending:{},error:'Network outcome uncertain'}));
    assert.match(content,/Check previous attempt using the original request/);
    assert.match(content,/Network outcome uncertain/);
  }
});
