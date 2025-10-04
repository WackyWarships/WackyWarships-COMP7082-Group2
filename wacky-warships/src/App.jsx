import { useEffect, useRef, useState } from 'react';

import Phaser from 'phaser';
import { PhaserGame } from './PhaserGame';
import { socket } from './socket';

function App ()
{
    const [roomID, setRoomId] = useState("None");
    const [joinRoomValue, setJoinRoomValue] = useState('');
    
    useEffect(() => {
        socket.connect();

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        function onReceiveRoomId(value) {
            setRoomId(value);
        }
        
        socket.on('room id', onReceiveRoomId);
        socket.on('ping', addSprite);

        return () => {
            socket.off('room id', onReceiveRoomId);
            socket.off('ping', addSprite);
        };
    }, [roomID]);
    
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef();

    const changeScene = () => {

        const scene = phaserRef.current.scene;

        if (scene)
        {
            scene.changeScene();
        }
    }

    const createRoom = () => {
        socket.emit('create room', '');
    }

    const joinRoom = () => {   
        socket.emit('join room', joinRoomValue);
        setJoinRoomValue('');
    }
    
    function handleChange(event) {
        setJoinRoomValue(event.target.value);
    }

    const addSprite = () => {

        const scene = phaserRef.current.scene;

        if (scene)
        {
            // Add more stars
            const x = Phaser.Math.Between(64, scene.scale.width - 64);
            const y = Phaser.Math.Between(64, scene.scale.height - 64);

            //  `add.sprite` is a Phaser GameObjectFactory method and it returns a Sprite Game Object instance
            const star = scene.add.sprite(x, y, 'star');

            //  ... which you can then act upon. Here we create a Phaser Tween to fade the star sprite in and out.
            //  You could, of course, do this from within the Phaser Scene code, but this is just an example
            //  showing that Phaser objects and systems can be acted upon from outside of Phaser itself.
            scene.add.tween({
                targets: star,
                duration: 500 + Math.random() * 1000,
                alpha: 0,
                yoyo: true,
                repeat: -1
            });
        }
    }

    const pingRoom = () => {
        socket.emit('ping', roomID);
    }

    // Event emitted from the PhaserGame component
    const currentScene = (scene) => {

        
    }

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <div>
                <div>
                    <button className="button" onClick={changeScene}>Change Scene</button>
                </div>
                <div>
                    <button className="button" onClick={createRoom}>Create Room</button>
                </div>
                <div>
                    <button className="button" onClick={joinRoom}>Join Room</button>
                    <input type="text" value={joinRoomValue} onChange={handleChange}/>
                </div>
                <div className="roomID">Room ID:
                    <pre>{`${roomID}`}</pre>
                </div>
                <div>
                    <button className="button" onClick={pingRoom}>Ping Room</button>
                </div>
            </div>
        </div>
    )
}

export default App
