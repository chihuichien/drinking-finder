import { useEffect, useState } from "react";
import "./App.css";
import drinking from "./DrinkingData.json";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Pin,
} from "@vis.gl/react-google-maps";

function App() {
  type UserType = {
    latitude: number;
    longitude: number;
  };
  type DrinkingJsonType = {
    name: string;
    drink: string[];
  };
  type googleBufferPlaceType = {
    displayName: { languageCode: string; text: string };
    location: { latitude: number; longitude: number };
    id: string;
    formattedAddress?: string;
  };

  const [userInput, setUserInput] = useState<string>("");
  const [userLocation, setUserLocation] = useState<UserType | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [matchingStores, setMatchingStores] = useState<DrinkingJsonType[]>([]);
  const [finalStores, setFinalStores] = useState<googleBufferPlaceType[]>([]);
  const [selectedPlace, setSelectedPlace] =
    useState<googleBufferPlaceType | null>(null);
  const mapContainerStyle = {
    width: "100%",
    height: "500px",
  };

  // 首次渲染取得使用者位置
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const position: GeolocationPosition = await new Promise(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        );
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        console.log(
          "Get user location: ",
          position.coords.longitude,
          position.coords.latitude
        );
        //setUserLocation({ latitude: 25.013577, longitude: 123.9846453 });
      } catch (error) {
        console.error("Failed to get user location:", error);
      }
    };

    requestLocationPermission();
  }, []);

  async function handleUserInputClick(): Promise<void> {
    if (!userInput.trim()) {
      alert("請輸入想喝的飲料!");
      return;
    }
    if (!userLocation) {
      alert("正在獲取位置，請稍候再試！");
      return;
    }

    // 找哪些飲料店有特定飲品
    const foundStoresInJson = drinking.filter((store) =>
      store.drink.includes(userInput.trim())
    );
    setMatchingStores(foundStoresInJson);
    console.log(matchingStores)
    //setUserInput("");
    /*console.log(
      "資料庫裡有賣的店家：",
      foundStoresInJson.map((store) => store.name)
    );*/

    // Google 找尋500公尺內手搖店
    const apikey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = "https://places.googleapis.com/v1/places:searchText";
    const distance = 800;
    // 地球每度緯度約111,000 m，每度經度在赤道約111,000 m，隨緯度增加而減少
    const { latitude, longitude } = userLocation;
    const latOffset = distance / 111000;
    const lonOffset =
      distance / (111000 * Math.cos((latitude * Math.PI) / 180));

    const requestBody = {
      textQuery: "飲料",
      languageCode: "zh-TW",
      pageSize: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        rectangle: {
          low: {
            latitude: latitude - latOffset,
            longitude: longitude - lonOffset,
          },
          high: {
            latitude: latitude + latOffset,
            longitude: longitude + lonOffset,
          },
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apikey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.id",
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error(`API response error! status code: ${response.status}`);
      }
      const data = await response.json();
      if (!data.places) {
        alert("搜尋範圍無手搖店！")
        return;
      }

      // 找範圍內符合名稱飲料店
      const currentMatchingStores = foundStoresInJson;
      const drinkingStoreInMap = data.places.filter(
        (place: googleBufferPlaceType) =>
          currentMatchingStores.some((store) =>
            place.displayName.text.includes(store.name)
          )
      );
      if (drinkingStoreInMap.length === 0) {
        alert("周圍沒有販售該飲品的店家！");
      }
      setFinalStores(drinkingStoreInMap);
      setHasSearched(true);
      console.log("周圍有販賣的店家：", drinkingStoreInMap);
      console.log("周圍的飲料店：", data.places);
    } catch (error) {
      console.error("API 請求失敗:", error);
    }
  }

  function handleUserInput(e: React.ChangeEvent<HTMLInputElement>): void {
    setUserInput(e.target.value);
  }

  return (
    <div className="py-9 font-slab bg-gradient-to-b from-white to-blue-100 min-h-screen">
      <p className="text-6xl mb-5 text-center bg-gradient-to-tr from-blue-300 to-blue-900 bg-clip-text text-transparent transition duration-1000 ease-in-out hover:bg-gradient-to-bl hover:from-sky-900 hover:to-sky-500 h-20">Drinking Finder</p>
      <div className="flex flex-col items-center gap-5">
        <label htmlFor="user-input" className="text-2xl font-semibold text-blue-900">
          輸入想喝的飲料:
        </label>
        <div>
          <input
            id="user-input"
            className="border-2 border-zinc-800 outline-blue-800 px-5 py-1 w-sm h-12 rounded-xl text-lg"
            value={userInput}
            onChange={handleUserInput}
          />
          <button
            className="bg-zinc-400 text-gray-100 hover:bg-zinc-500 hover:text-white p-2 w-20 ml-3 rounded-xl cursor-pointer duration-200"
            onClick={handleUserInputClick}
          >
            Submit
          </button>
        </div>
        <p className="text-xs">*註：因飲料資訊尚不足，建議以「綠茶」、「紅茶」、「冬瓜檸檬」、「綠茶拿鐵」做測試</p>
      </div>
      <div className="mt-10 flex flex-col items-center py-8">
        <p className="text-2xl font-semibold text-gray-700">Google Map</p>

        {/* Google Map 顯示處 */}
        {userLocation ? <div className="mt-4 mb-10 border-2 w-[80%]">
          <APIProvider
            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            onLoad={() => console.log("map onload")}
          >
            <Map
              defaultCenter={
                userLocation
                  ? { lat: userLocation.latitude, lng: userLocation.longitude }
                  : { lat: 25.033964, lng: 121.564468 }
              }
              defaultZoom={13}
              style={mapContainerStyle}
              mapId="DEMO_MAP_ID"
            >
              {/* 使用者位置標記點 */}
              <AdvancedMarker
                key="my-location"
                position={
                  userLocation
                    ? {
                        lat: userLocation.latitude,
                        lng: userLocation.longitude,
                      }
                    : null
                }
                onClick={() =>
                  setSelectedPlace({
                    displayName: { languageCode: "zh-tw", text: "你的位置" },
                    location: {
                      latitude: userLocation!.latitude,
                      longitude: userLocation!.longitude,
                    },
                    id: "my-location",
                  })
                }
              >
                <Pin
                  background={"#f65e5a"}
                  glyphColor={"#000"}
                  borderColor={"#000"}
                />
              </AdvancedMarker>

              {/* 手搖店家標記點 */}
              {finalStores.map((store) => {
                return (
                  <AdvancedMarker
                    key={store.displayName.text}
                    position={{
                      lat: store.location.latitude,
                      lng: store.location.longitude,
                    }}
                    onClick={() => {
                      setSelectedPlace(store);
                    }}
                  >
                    <Pin
                      background={"#78e1b6"}
                      glyphColor={"#000"}
                      borderColor={"#000"}
                    />
                  </AdvancedMarker>
                );
              })}

              {/* 標記點 click 小視窗 */}
              {selectedPlace && (
                <InfoWindow
                  position={{
                    lat: selectedPlace.location.latitude,
                    lng: selectedPlace.location.longitude,
                  }}
                  onCloseClick={() => setSelectedPlace(null)}
                >
                  <div>
                    <p className="font-semibold text-base">
                      {selectedPlace.displayName.text}
                    </p>
                    <p className="text-sm">{selectedPlace.formattedAddress}</p>
                    <button
                      onClick={() => {
                        if (selectedPlace.id === "my-location") {
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${selectedPlace.location.latitude},${selectedPlace.location.longitude}`,
                            "_blank"
                          );
                        } else {
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.displayName.text)}&query_place_id=${selectedPlace.id}`,
                            "_blank"
                          );
                        }
                      }}
                      className="bg-zinc-200 hover:bg-zinc-300 hover:text-sky-700 border border-gray-300 p-2 cursor-pointer rounded-xl mt-2"
                    >
                      開始導航
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div> : <p className="mt-8 text-xl">取用位置中，請稍候......</p>}

        {/* 條列販售飲料店 */}
        <div className="w-1/2">
          {finalStores.length > 0 && (
            <p className="font-semibold text-xl my-5 text-gray-800">
              周圍 800 公尺販售「{userInput}」的店家
            </p>
          )}
          {hasSearched &&
            (finalStores.length ? (
              finalStores.map((store) => (
                <p
                  key={store.displayName.text}
                  onClick={() => setSelectedPlace(store)}
                  className="cursor-pointer hover:text-blue-700 hover:bg-zinc-400 bg-gray-300 duration-100 mt-3 px-5 py-3 rounded-xl"
                >
                  {store.displayName.text}
                </p>
              ))
            ) : (
              <p className="font-semibold text-xl my-5">
                周圍無販售該飲品之店家
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
