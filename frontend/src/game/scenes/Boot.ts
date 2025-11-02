import { Scene } from 'phaser';
import { initSocket } from '../../api/socket';
import { getStoredPlayerName } from '../utils/playerUsername';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
        //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

        this.load.image('background', 'assets/bg.png');
    }

    create() {
        initSocket();
        const savedName = getStoredPlayerName();
        if (savedName) {
            this.scene.start('Preloader');
        } else {
            this.scene.start('EnterUsername'); 
        }
    }
}
