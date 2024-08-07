import React, { useState } from 'react';
// import { collection, addDoc } from 'firebase/firestore';
// import { db } from './firebase';
import Button from "./Button";
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';


const SurveyForm = () => {
  const [responses, setResponses] = useState({
    question1: '',
    question2: ''
  });

  const handleChange = (e) => {
    setResponses({
      ...responses,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
		console.log("FORM SUBMITTED")

    try {
			await addDoc(collection(db, 'Responses'), {
				...responses,
        timestamp: new Date()
      });
      // alert('Survey submitted successfully!');
      setResponses({ question1: '', question2: '' });
			window.open('https://t.me/ozar_community', '_blank', 'noopener,noreferrer');
    } catch (error) {
			window.open('https://t.me/ozar_community', '_blank', 'noopener,noreferrer');
      console.error('Error submitting survey: ', error);
      alert('An error occurred while submitting the survey');
    }
  };

  // return (
  //   <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
	// 		<div className="text-center">
	// 			<p className="font-bold mb-4">What chain are you looking to launch your tokens on?</p>
	// 			<div className="flex flex-wrap justify-center gap-4">
	// 				{['Solana', 'Base', 'Ethereum'].map((answer) => (
	// 					<label key={answer} className="inline-flex items-center">
	// 						<input 
	// 							type="radio" 
	// 							name="question1" 
	// 							value={answer} 
	// 							checked={responses.question1 === answer}
	// 							onChange={handleChange}
	// 							className="form-radio"
	// 						/>
	// 						<span className="ml-2">{answer}</span>
	// 					</label>
	// 				))}
	// 			</div>
	// 		</div>

	// 		<div className="text-center">
	// 			<p className="font-bold mb-4">Which of our products are you most excited to use for your next token launch?</p>
	// 			<div className="flex flex-wrap justify-center gap-4">
	// 				{['PumpFun Bundler', 'Raydium Bundler', 'Uniswap Bundler', 'Raydium Rank Booster', 'Uniswap Rank Booster'].map((product) => (
	// 					<label key={product} className="inline-flex items-center">
	// 						<input 
	// 							type="radio" 
	// 							name="question2" 
	// 							value={product} 
	// 							checked={responses.question2 === product}
	// 							onChange={handleChange}
	// 							className="form-radio"
	// 						/>
	// 						<span className="ml-2">{product}</span>
	// 					</label>
	// 				))}
	// 			</div>
	// 		</div>

	// 		<div className="flex justify-center mt-12 md:mt-15 xl:mt-20">
	// 			<Button onClick={handleSubmit} type="submit" className="text-lg px-6 py-3 md:text-xl md:px-8 md:py-4" >Submit and Join Telegram</Button>
	// 		</div>
	// 	</form>
  // );


	return (
		<form onSubmit={handleSubmit} className="space-y-12 max-w-3xl mx-auto p-6 rounded-lg">
			<div className="text-center bg-gray-800 p-6 rounded-lg">
				<p className="font-bold mb-6 text-xl text-white">What chain are you looking to launch your tokens on?</p>
				<div className="flex flex-wrap justify-center gap-6">
					{['Solana', 'Base', 'Ethereum'].map((answer) => (
						<label key={answer} className="inline-flex items-center group">
							<input 
								type="radio" 
								name="question1" 
								value={answer} 
								checked={responses.question1 === answer}
								onChange={handleChange}
								className="form-radio h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
							/>
							<span className="ml-3 text-lg text-white group-hover:text-blue-400 transition duration-150 ease-in-out">{answer}</span>
						</label>
					))}
				</div>
			</div>

			<div className="text-center bg-gray-800 p-6 rounded-lg">
				<p className="font-bold mb-6 text-xl text-white">Which product are you most excited to use for your next token launch?</p>
				<div className="flex flex-wrap justify-center gap-6">
					{['PumpFun Bundler', 'Raydium Bundler', 'Uniswap Bundler', 'Raydium Rank Booster', 'Uniswap Rank Booster'].map((product) => (
						<label key={product} className="inline-flex items-center group">
							<input 
								type="radio" 
								name="question2" 
								value={product} 
								checked={responses.question2 === product}
								onChange={handleChange}
								className="form-radio h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
							/>
							<span className="ml-3 text-lg text-white group-hover:text-blue-400 transition duration-150 ease-in-out">{product}</span>
						</label>
					))}
				</div>
			</div>

			<div className="flex justify-center mt-12">
				{/* <button 
					onClick={handleSubmit} 
					type="submit" 
					className="text-lg px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition duration-300 flex items-center"
				>
					<svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path d="M18.384,22.779c0.322,0.228 0.737,0.285 1.107,0.145c0.37,-0.141 0.642,-0.457 0.724,-0.84c0.869,-4.084 2.977,-14.421 3.768,-18.136c0.06,-0.28 -0.04,-0.571 -0.26,-0.758c-0.22,-0.187 -0.525,-0.241 -0.797,-0.14c-4.193,1.552 -17.106,6.397 -22.384,8.35c-0.335,0.124 -0.553,0.446 -0.542,0.799c0.011,0.354 0.249,0.661 0.593,0.764c2.367,0.708 5.474,1.693 5.474,1.693c0,0 1.452,4.385 2.209,6.615c0.095,0.28 0.314,0.5 0.603,0.576c0.288,0.075 0.596,-0.004 0.811,-0.207c1.216,-1.148 3.096,-2.923 3.096,-2.923c0,0 3.572,2.619 5.598,4.062Zm-11.01,-8.677l1.679,5.538l0.373,-3.507c0,0 6.487,-5.851 10.185,-9.186c0.108,-0.098 0.123,-0.262 0.033,-0.377c-0.089,-0.115 -0.253,-0.142 -0.376,-0.064c-4.286,2.737 -11.894,7.596 -11.894,7.596Z"/>
					</svg>
					Submit and Join Telegram
				</button> */}
				<Button onClick={handleSubmit} type="submit" className="text-lg px-6 py-3 md:text-xl md:px-8 md:py-4" >Submit and Join Telegram</Button>

			</div>
		</form>
	);
};

export default SurveyForm;