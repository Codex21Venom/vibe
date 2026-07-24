import { useEffect, useRef, useState } from "react";
import CameraProcessor from "./CameraProcessor";
import * as faceDetection from "@tensorflow-models/face-detection";

import type { MLProcessor } from "@/types/ai.types";
import { unRegisterStream } from "@/lib/MediaRegistry";

const useCameraProcessor = (frameRate = 3) => {
  useEffect(() => {
    return () => {
      unRegisterStream("CameraProcessor-stream");
    };
  }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageSrcs, setImageSrcs] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [faces, setFaces] = useState<faceDetection.Face[]>([]);
  const cameraProcessorRef = useRef<CameraProcessor | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false); // Add a ref to track model readiness without causing re-renders

  // Initialize worker once on mount
  useEffect(() => {
    workerRef.current = new Worker(new URL("./FaceDetectorWorker.ts", import.meta.url), { type: "module" });

    workerRef.current.onmessage = (event) => {
      if (event.data.type === "MODEL_READY") {
        console.log("✅ MODEL_READY received, setting modelReady to true");
        setModelReady(true);
        modelReadyRef.current = true;
      } else if (event.data.type === "DETECTION_RESULT") {
        setFaces(event.data.faces);
      } else if (event.data.type === "ERROR") {
        console.error("Worker Error:", event.data.message);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("[useCameraProcessor] Worker error:", error);
    };

    workerRef.current.postMessage({ type: "INIT" });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      modelReadyRef.current = false;
      setModelReady(false);
      setFaces([]);
    };
  }, []);

  // Initialize and run CameraProcessor when frameRate changes or on mount
  useEffect(() => {
    const initializeCamera = async () => {
      if (cameraProcessorRef.current) {
        cameraProcessorRef.current.stopCapturing();
      }

      cameraProcessorRef.current = new CameraProcessor(frameRate);

      const processWithML: MLProcessor = (image) => {
        if (!workerRef.current || !modelReadyRef.current) {
          if (image && typeof image.close === "function") image.close();
          return;
        }
        try {
          workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
        } catch (error) {
          console.error("Error processing image:", error);
          if (image && typeof image.close === "function") image.close();
        }
      };

      cameraProcessorRef.current.addMLProcessor(processWithML);

      if (!videoRef.current) return;

      await cameraProcessorRef.current.initialize(videoRef.current);

      setTimeout(() => {
        cameraProcessorRef.current?.startCapturing();
      }, 200);
    };

    initializeCamera();

    return () => {
      cameraProcessorRef.current?.stopCapturing();
    };
  }, [frameRate]);

  useEffect(() => {
    console.log("🔍 useCameraProcessor State:", {
      modelReady,
      facesCount: faces.length,
      hasWorker: !!workerRef.current,
      hasVideo: !!videoRef.current
    });
  }, [modelReady, faces.length]);

  return { videoRef, modelReady, faces, imageSrcs };

};

export default useCameraProcessor;
