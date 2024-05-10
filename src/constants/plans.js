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
                description: "Assist your clients in a couple of seconds. Just answer and start attending them!",
                call: "true",
                all: "true",
                car: "false"
            },
            row2: {
                name: "Unlimited distance for every connection",
                description: "It doesn't matter where your agents are located. VideFace can handle that.",
                call: "true",
                all: "true",
                car: "false"
            },
            row3:{
                name: "Audio and Video custom configuration",
                description: "You can change your multimedia settings to fit your needs and preferences.",
                call: "true",
                all: "true",
                car: "false"
            },
            row4:{
                name: "Unlimited amount of calls per kiosk",
                description: "There is no limit on how many calls you can assist everyday. Don't worry about bussy days!",
                call: "true",
                all: "true",
                car: "false"
            },
            row5:{
                name: "Unlimited time for each call",
                description: "The calls can last as long as your agents and clients need. It's up to them!",
                call: "true",
                all: "true",
                car: "false"
            },
            row6:{
                name: "Capacity to force a call to any kiosk",
                description: "Just press a button to connect automatically to any kiosk you want.",
                call: "true",
                all: "true",
                car: "false"
            },
            row7:{
                name: "Complete management for incoming calls",
                description: "Be aware of which kiosks are calling right now to make the best decisions.",
                call: "true",
                all: "true",
                car: "false"
            },
            row8:{
                name: "Connect from any device",
                description: "VideFace works with PC, Tablets and even phones! Depends on your necessities.",
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
                description: "Set up a name for the kiosk and an office to always identify it.",
                call: "true",
                all: "true",
                car: "false"
            },
            row3: {
                name: "Easily setup your kiosk on the device with just a login",
                description: "Just open the website and log in into your kiosk's account. It's that easy!",
                call: "true",
                all: "true",
                car: "false"
            },
            row4: {
                name: "Personalize the kiosk's screens displayed to your clients",
                description: "Have different screens and personalize them depending on the situation.",
                call: "true",
                all: "true",
                car: "false"
            },
            row5: {
                name: "Customize your kiosks design and colors",
                description: "Choose between multiple styles and change the colors to match with your office.",
                call: "true",
                all: "true",
                car: "false"
            },
            row6: {
                name: "Close hours: define when the kiosk will be closed",
                description: "Configure the hours to close the kiosks in your office and show a custom screen.",
                call: "true",
                all: "true",
                car: "false"
            },
            row7: {
                name: "Set a kiosk to not be available as long as you need",
                description: "Have a custom screen to represent this possible event in case you need it.",
                call: "true",
                all: "true",
                car: "false"
            },
            row8: {
                name: "Filter your kiosks by office and set them to specific agents",
                description: "Each agent can select the kiosks to assist, or limit both by offices.",
                call: "Soon",
                all: "Soon",
                car: "false"
            },
            row9: {
                name: "History and metrics for every kiosk",
                description: "View useful information to learn how your kiosks are going every month.",
                call: "Soon",
                all: "true",
                car: "false"
            },
        }
    },
    {
        id:3,
        title: {
            icon: "text",
            text: "Agent features"
        },
        elements: {
            row1: {
                name: "Change the agent's information anytime",
                description: "Change the name, QR code and more.",
                call: "true",
                car: "true",
                all: "true"
            },
            row2: {
                name: "List of actions from other agents in real time",
                description: "Know who is forcing a call or reloading a kiosk, organized by time and date.",
                call: "true",
                car: "false",
                all: "true"
            },
            row4: {
                name: "Calls history, duration and metrics for each agent",
                description: "Have metrics about your agents history to take better decisions.",
                call: "Soon",
                car: "false",
                all: "true"
            },
            row5: {
                name: "Actions history and metrics for each agent",
                description: "Know who did an specific action to have a safe environment inside VideFace.",
                call: "Soon",
                car: "Soon",
                all: "true"
            },
            row6: {
                name: "Your custom QR code to rate the agent in your webpage",
                description: "Upload your own QR to rate your agent inside your own system.",
                call: "true",
                car: "false",
                all: "true"
            },
            row7: {
                name: "VideFace internal rating system for each agent",
                description: "Know each agent's rating based on the client's opinion.",
                call: "Soon",
                car: "false",
                all: "true"
            },
        }
    },
    {
        id:4,
        title: {
            icon: "text",
            text: "Admin features"
        },
        elements: {
            row1: {
                name: "All agent's features",
                description: "Admins can assist calls, do actions, have ratings and more, just like agents.",
                call: "true",
                car: "true",
                all: "true"
            },
            row2: {
                name: "Manage all the users (agents and kiosks)",
                description: "Be in charge of the data that involves agents and kiosks. Modify it for your needs.",
                call: "true",
                car: "false",
                all: "true"
            },
            row3: {
                name: "Dashboard for the agent's individual information",
                description: "See the metrics related to an specific agent of your company",
                call: "Soon",
                car: "Soon",
                all: "true"
            },
            row4: {
                name: "Dashboard for the agent's global information",
                description: "See the metrics for all the agents in your company combined and compared.",
                call: "Soon",
                car: "Soon",
                all: "true"
            },
            row5: {
                name: "Dashboard for the kiosk's individual information",
                description: "See the metrics for an specific kiosk of any office inside your company.",
                call: "Soon",
                car: "false",
                all: "true"
            },
            row6: {
                name: "Dashboard for the kiosk's global information",
                description: "See the metrics for all your kiosks combined and compare them.",
                call: "Soon",
                car: "false",
                all: "true"
            },
            row7: {
                name: "Manage all global features (if applies)",
                description: "Admins are able to change company information, offices and more.",
                call: "true",
                car: "true",
                all: "true"
            },
        }
    },
    {
        id:5,
        title: {
            icon: "text",
            text: "Global features"
        },
        elements: {
            row1: {
                name: "Global reload: refresh all your kiosks at the same time",
                description: "Just one click to refresh all your kiosks at once in any case you need to do this.",
                call: "true",
                car: "false",
                all: "true"
            },
            row2: {
                name: "Real time notifications for all the agents and admins",
                description: "Be able to create notifications for your users to inform anything.",
                call: "true",
                car: "true",
                all: "true"
            },
            row3: {
                name: "Fast access to all your information and services",
                description: "View all your data, information and more in an intuitive interface.",
                call: "true",
                car: "true",
                all: "true"
            },
            row4: {
                name: "Support from VideFace Team for any of your needs",
                description: "Contact us at anytime to supply your needs, we will answer as soon as possible.",
                call: "true",
                car: "true",
                all: "true"
            },
        }
    },
    {
        id:6,
        title: {
            icon: "text",
            text: "Car Inspection Service"
        },
        elements: {
            row1: {
                name: "Create your own fleet of cars",
                description: "Have all your cars with its information in real time. Manage them as you wish!",
                call: "false",
                car: "true",
                all: "true"
            },
            row2: {
                name: "Set any agent to manage cars (admins do it by default)",
                description: "Decide if you want some agents to also manage cars, or just the admins.",
                call: "false",
                car: "true",
                all: "true"
            },
            row3: {
                name: "Add base pictures for each car",
                description: "You can upload up to 12 base images that will represent your car.",
                call: "false",
                car: "true",
                all: "true"
            },
            row4: {
                name: "Add multiple damage pictures for each base picture",
                description: "Upload up to 25 damages per base image and change them as you wish,",
                call: "false",
                car: "true",
                all: "true"
            },
            row5: {
                name: "Generated link and QR code to check the car",
                description: "Automatically generate the car link and QR so your clients can open that page with it.",
                call: "false",
                car: "true",
                all: "true"
            },
            row6: {
                name: "See each car's current conditions with the link",
                description: "Clients will see in real time the base images and damages of the car.",
                call: "false",
                car: "true",
                all: "true"
            },
            row7: {
                name: "Terms and conditions email delivery",
                description: "Inform your clients and yourself when they've accepted your terms and conditions.",
                call: "false",
                car: "false",
                all: "false"
            },
            row8: {
                name: "Car Walk Around email delivery",
                description: "Send an email to your client and yourself with the Walk Around pictures to have evidence.",
                call: "false",
                car: "true",
                all: "true"
            },
            row9: {
                name: "Clients can take pictures to the car for pickup and return",
                description: "Save money and bad experiences with evidence of each car rental process.",
                call: "false",
                car: "true",
                all: "true"
            },
            row10: {
                name: "Have all the clients pictures for each car inside VideFace",
                description: "You'll have a history of all the pictures related to each car, specially the ones from the clients.",
                call: "false",
                car: "Soon",
                all: "Soon"
            },
            row11: {
                name: "Edit or delete existing cars in real time",
                description: "You're able to change the information related to your cars, or just delete them.",
                call: "false",
                car: "true",
                all: "true"
            },
        }
    },
    {
        id:7,
        title: {
            icon: "text",
            text: "VideFace AutoKeys System"
        },
        elements: {
            row1: {
                name: "Manage all the keys of your offices in real time",
                description: "Be aware of the available keys for your offices with our connection with KeyCafe",
                call: "false",
                car: "true",
                all: "true"
            },
            row2: {
                name: "Give the keys to your clients with just one click",
                description: "Be able to do this inside VideFace by generating a new code or just opening the box.",
                call: "false",
                car: "true",
                all: "true"
            },
            row3: {
                name: "Easily have your keys organized so your agents can give them at distance",
                description: "We will display the current keys available depending on the kiosk you're assisting.",
                call: "false",
                car: "true",
                all: "true"
            },
            row4: {
                name: "Actions history for the keys",
                description: "KeyCafe can display the history of any key with precise information.",
                call: "false",
                car: "true",
                all: "true"
            },
        }
    },
    {
        id:8,
        title: {
            icon: "text",
            text: "Offices Management"
        },
        elements: {
            row1: {
                name: "All your systems in one place for easy management",
                description: "Divide your VideFace by offices and get the full experience to save time and money.",
                call: "true",
                car: "true",
                all: "true"
            },
            row2: {
                name: "Asign agents to specific offices and/or kiosks",
                description: "In case you need to limit your agents to specific offices or kiosks, you'll be able to do so.",
                call: "Soon",
                car: "Soon",
                all: "Soon"
            },
            row3: {
                name: "Asign cars and their keys to specific offices",
                description: "All the cars are organized by offices for a better experience.",
                call: "false",
                car: "true",
                all: "true"
            },
            row4: {
                name: "See the overall working of all your offices",
                description: "Get the information you need about your offices in real time.",
                call: "false",
                car: "true",
                all: "true"
            },
        }
    },
    {
        id:9,
        title: {
            icon: "text",
            text: "Worry-free Cloud Hosting"
        },
        elements: {
            row1: {
                name: "We set up your VideFace domain and host it for you",
                description: "You will have a personalized URL for your company, great for easy access from anywhere.",
                call: "true",
                car: "true",
                all: "true"
            },
            row2: {
                name: "No servers needed, we take care of that",
                description: "All you need is to start using VideFace and we'll take care of everything related to servers.",
                call: "true",
                car: "true",
                all: "true"
            },
            row3: {
                name: "Data is securely stored using Firebase from Google",
                description: "Our cloud-based infrastructure allows you to interact in real time as you wish.",
                call: "true",
                car: "true",
                all: "true"
            },
        }
    }
];
