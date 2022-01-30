

import * as THREE from './threejs/three.js/build/three.module.js';

import Stats from './threejs/three.js/examples/jsm/libs/stats.module.js';

import { GLTFLoader } from './threejs/three.js/examples/jsm/loaders/GLTFLoader.js';

import { Octree } from './threejs/three.js/examples/jsm/math/Octree.js';
import { Capsule } from './threejs/three.js/examples/jsm/math/Capsule.js';

let scene,clock,camera;
let ambientlight,fillLight1,fillLight2,directionalLight,renderer,container,stats,sphereGeometry,sphereMaterial;
let cube,geometry;

const spheres = [];

const loader = new GLTFLoader();

let sphereIdx = 0;

let worldOctree;
let playerCollider;


let playerVelocity;
let playerDirection;

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

let vector1;
let vector2;
let vector3;

const GRAVITY = 30;

const NUM_SPHERES = 100;
const SPHERE_RADIUS = 0.2;

const STEPS_PER_FRAME = 5;

init();
loader.load( 'myWorld.glb', ( gltf ) => {

    scene.add( gltf.scene );

    worldOctree.fromGraphNode( gltf.scene );

    gltf.scene.traverse( child => {

        if ( child.isMesh ) {

            child.castShadow = true;
            child.receiveShadow = true;

            if ( child.material.map ) {

                child.material.map.anisotropy = 8;

            }

        }

    } );

    animate();

} );

function init()
{
    //创建形状 BoxGeometry
    geometry = new THREE.BoxGeometry(1,1,1);
    var geometry1 = new THREE.BoxGeometry(1,1,1);


    //创建材料   wireframe是否使用线条
    var material = new THREE.MeshBasicMaterial({color:0xFFFFFF,wireframe:true});

    //将材料和形状结合
    cube = new THREE.Mesh(geometry,material);




    //初始化场景，
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x54abef );

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.rotation.order = 'YXZ';

    //由于这里才创建了scene，我们把cube在这里加入场景中
    scene.add(cube);

    clock = new THREE.Clock();

    ambientlight = new THREE.AmbientLight( 0x6688cc );

    scene.add( ambientlight );

    fillLight1 = new THREE.DirectionalLight( 0xff9999, 0.5 );
    fillLight1.position.set( - 1, 1, 2 );
    scene.add( fillLight1 );

    fillLight2 = new THREE.DirectionalLight( 0x8888ff, 0.2 );
    fillLight2.position.set( 0, - 1, 0 );
    scene.add( fillLight2 );

    directionalLight = new THREE.DirectionalLight( 0xffffaa, 1.2 );
    directionalLight.position.set( - 5, 25, - 1 );
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.01;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.left = - 30;
    directionalLight.shadow.camera.top	= 30;
    directionalLight.shadow.camera.bottom = - 30;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.radius = 4;
    directionalLight.shadow.bias = - 0.00006;
    scene.add( directionalLight );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    container = document.getElementById( 'container' );

    container.appendChild( renderer.domElement );

    //显示性能监测插件stats
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';

    container.appendChild( stats.domElement );





    //新建八叉树
    worldOctree = new Octree();

    //新建碰撞器，本质上是一个球体加一个圆柱体组成
    playerCollider = new Capsule( new THREE.Vector3( 0, 0.01, 0 ), new THREE.Vector3( 0, 0.015, 0 ), 0.4 );

    //碰撞器速度
    playerVelocity = new THREE.Vector3();
    //碰撞器方向
    playerDirection = new THREE.Vector3();


    vector1 = new THREE.Vector3();
    vector2 = new THREE.Vector3();
    vector3 = new THREE.Vector3();
}



document.addEventListener( 'keydown', ( event ) => {

    keyStates[ event.code ] = true;

} );

document.addEventListener( 'keyup', ( event ) => {

    keyStates[ event.code ] = false;

} );

document.addEventListener( 'mousedown', () => {

    document.body.requestPointerLock();

    mouseTime = performance.now();

} );


document.body.addEventListener( 'mousemove', ( event ) => {

    //pointerLockElement特性规定了如在 鼠标事件中当目标被锁定时的元素集和。如果指针处于锁定等待中、指针没有被锁定，或者目标在另外一个文档中这几种情况，返回的值null
    if ( document.pointerLockElement === document.body ) {

       //鼠标左右移动时，摄像机绕y轴旋转，画面左右变化。
        camera.rotation.y -= event.movementX / 500;
        //鼠标上下移动时，摄像机绕x轴旋转，画面上下变化。
        camera.rotation.x -= event.movementY / 500;

    }

} );



window.addEventListener( 'resize', onWindowResize );

function onWindowResize() {

    //相机视角的长宽比，与屏幕保持一致
    camera.aspect = window.innerWidth / window.innerHeight;
    //如果相机对象与投影矩阵相关的属性发生了变化，就需要手动更新相机的投影矩阵，执行camera.updateProjectionMatrix();的时候，
    // threejs会重新计算相机对象的投影矩阵值，如果相机对象的投影矩阵相关属性没有变化，每次执行.render()方法的时候，都重新计算相机投影矩阵值，会浪费不必要的计算资源,一般来说就是首次渲染计算一次，后面不执行.updateProjectionMatrix()方法threejs不会读取相机相关属性重新计算投影矩阵值，直接使用原来的值就可以。
    //
    // 无论正投影相机还是投影投影相机对象的.near和.far属性变化，都需要手动更新相机对象的投影矩阵。
    //
    // 比如透视投影相机对象的.aspect、.fov属性变化，会影响相机的投影矩阵属性.projectionMatrix,需要执行.updateProjectionMatrix ()更新相机对象的投影矩阵属性
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}



function playerCollisions() {


    const result = worldOctree.capsuleIntersect( playerCollider );

    playerOnFloor = false;

    if ( result ) {



        playerOnFloor = result.normal.y > 0;


        //对elements所有元素分别*=s，使碰撞体的位置限制在八叉树的边界地带，translate就是将他移动到这里不能在改变
        playerCollider.translate( result.normal.multiplyScalar( result.depth ) );

    }

}

function updatePlayer( deltaTime ) {

    let damping = Math.exp( - 4 * deltaTime ) - 1;

    if ( ! playerOnFloor ) {

        //下落速度等于加速度*时间
        playerVelocity.y -= GRAVITY * deltaTime;


        // 空气阻力
        damping *= 0.1;

    }

    //该方法是可以平滑的从A逐渐移动到B点，考虑空气阻力，可以控制速度，最常见的用法是相机跟随目标。
    playerVelocity.addScaledVector( playerVelocity, damping );



    //速度乘时间得到物体最终位置
    const deltaPosition = playerVelocity.clone().multiplyScalar( deltaTime );
    //移动到物体最终位置
    playerCollider.translate( deltaPosition );

    playerCollisions();

    //相机跟随物体
    camera.position.copy( playerCollider.end );

}

//camera.getWorldDirection( playerDirection ); 进行复制
//playerDirection.normalize();进行方向向量的归一化
//playerDirection.cross( camera.up );获取两个向量的叉乘，叉乘的几何含义是获取一个方向向量，垂直于两个向量组成的平面，方向遵照右手螺旋法则，从起始向量向结束向量螺旋


function getForwardVector() {

    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();
    //复制得到相机方向，向着相机方向移动
    return playerDirection;

}

function getSideVector() {

    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross( camera.up );
    //进行一个变换，得到与相机法向量相互垂直的另一个向量，方向向着这个相连
    return playerDirection;

}

function controls( deltaTime ) {

    // gives a bit of air control
    const speedDelta = deltaTime * ( playerOnFloor ? 25 : 8 );

    if ( keyStates[ 'KeyW' ] ) {

        playerVelocity.add( getForwardVector().multiplyScalar( speedDelta ) );

    }

    if ( keyStates[ 'KeyS' ] ) {

        playerVelocity.add( getForwardVector().multiplyScalar( - speedDelta ) );

    }

    if ( keyStates[ 'KeyA' ] ) {

        playerVelocity.add( getSideVector().multiplyScalar( - speedDelta ) );

    }

    if ( keyStates[ 'KeyD' ] ) {

        playerVelocity.add( getSideVector().multiplyScalar( speedDelta ) );

    }

    if ( playerOnFloor ) {

        if ( keyStates[ 'Space' ] ) {

            playerVelocity.y = 15;

        }

    }

}


function animate() {

    const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;

    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.

    cube.rotation.x +=0.01;
    cube.rotation.z += 0.005;

    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {

        controls( deltaTime );

        updatePlayer( deltaTime );


    }

    renderer.render( scene, camera );

    stats.update();

    requestAnimationFrame( animate );

}
