import { Scene } from "phaser";
import { initSocket } from "../../api/socket";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        // Minimal assets required before Preloader runs
        this.load.image("background", "assets/bg.png");
    }

    create() {
        initSocket();
        this.scene.start("Preloader");
        this.scale.lockOrientation("portrait");
    }
    
    // private checkOrientation (orientation: Scale.Orientation)
    // {
    //     this.checkOrientation(this.scale.orientation);
    // }
}

export default Boot;
