export const plans = [
    {
      id: "0",
      title: "VideFace Calls",
      description: "Monthly prices per office.",
      price1: "2 Kiosks $649",
      price2: "3 Kiosks $849",
      price3: "Extra: $149 each",
    },
    {
      id: "2",
      title: "VideFace Cars",
      description: "Monthly prices for all cars.",
      price1: "200 Cars $249",
      price2: "300 Cars $299",
      price3: "Every 100+ for $50",
    },
    {
        id: "1",
        title: "Full VideFace",
        description: "VideFace Calls + VideFace Cars and more!",
        price1: "Previous prices",
        price2: "Get new features",
        price3: "No car's initial fee",
      },
  ];

export const tablesData = [
    {
        id:1,
        title: {
            icon: "text",
            text: "Real time videocall"
        },
        elements: {
            row1: {
                name: "Fast connection between agent and client",
                call: "true",
                all: "true",
                car: "false"
            },
            row2: {
                name: "Unlimited distance for every connection",
                call: "true",
                all: "true",
                car: "false"
            },
            row3:{
                name: "Audio and Video custom configuration",
                call: "true",
                all: "true",
                car: "false"
            },
            row4:{
                name: "Unlimited amount of calls per kiosk",
                call: "true",
                all: "true",
                car: "false"
            },
            row5:{
                name: "Unlimited time for each call",
                call: "true",
                all: "true",
                car: "false"
            },
            row6:{
                name: "Capacity to force a call to any kiosk",
                call: "true",
                all: "true",
                car: "false"
            },
            row7:{
                name: "Complete management for incoming calls",
                call: "true",
                all: "true",
                car: "false"
            },
            row8:{
                name: "Connect from any device (computer, tablet, etc.)",
                call: "true",
                all: "true",
                car: "false"
            },
        }
    },
    {
        id:2,
        title: {
            icon: "text",
            text: "Kiosk features"
        },
        elements: {
            row1: {
                name: "Create the kiosks with the information you need",
                call: "false",
                all: "true",
                car: "true"
            },
            row2: {
                name: "Change the kiosk's information anytime",
                call: "true",
                all: "false",
                car: "true"
            },
            row3: {
                name: "Easily setup your kiosk on the device with just a login",
                call: "true",
                all: "false",
                car: "true"
            },
            row4: {
                name: "Personalize the kiosk's screens displayed to your clients",
                call: "true",
                all: "false",
                car: "true"
            },
            row5: {
                name: "Amount of total custom screens your company can have",
                call: "true",
                all: "false",
                car: "true"
            },
            row6: {
                name: "Close hours: define when the kiosk will be closed",
                call: "true",
                all: "false",
                car: "true"
            },
            row7: {
                name: "Temporarily closed: set a kiosk to not be available as long as you need",
                call: "true",
                all: "false",
                car: "true"
            },
            row8: {
                name: "Filter your kiosks by office and set them to specific agents",
                call: "true",
                all: "false",
                car: "true"
            },
            row9: {
                name: "History and metrics for every kiosk",
                call: "true",
                all: "false",
                car: "true"
            },
        }
    }
];
